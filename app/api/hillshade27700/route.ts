import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import proj4 from 'proj4';
import { OS_PROJECTION } from '@/lib/map-config';

// Register projections once
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
proj4.defs('EPSG:27700', OS_PROJECTION.proj4);

const SIZE = 256;

// Hard-coded hillshade params (same as /api/hillshade)
const Z_FACTOR = 3.5;
const SUN_AZ = 315 * (Math.PI / 180);
const SUN_ALT = 35 * (Math.PI / 180);
const Lx = Math.sin(SUN_AZ) * Math.cos(SUN_ALT);
const Ly = Math.cos(SUN_AZ) * Math.cos(SUN_ALT);
const Lz = Math.sin(SUN_ALT);

async function fetchTerrElev(z: number, x: number, y: number): Promise<Float32Array | null> {
  try {
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const elev = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      elev[i] = data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768;
    }
    return elev;
  } catch {
    return null;
  }
}

function lngLatToTerrPx(lng: number, lat: number, terrN: number): [number, number] {
  const latRad = lat * (Math.PI / 180);
  const px = ((lng + 180) / 360) * terrN * SIZE;
  const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * terrN * SIZE;
  return [px, py];
}

const emptyPng = async () => {
  const buf = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const z = parseInt(searchParams.get('z') ?? '7', 10);
  const x = parseInt(searchParams.get('x') ?? '0', 10);
  const y = parseInt(searchParams.get('y') ?? '0', 10);
  const dark = searchParams.get('dark') === '1';

  if (z < 0 || z > 9) return emptyPng();

  // Scale terrarium zoom to match BNG resolution — avoids blocky DEM at high OS zoom levels.
  // OS z=8 (3.5 m/px) and z=9 (1.75 m/px) need finer DEM than the z=12 default (≈22 m/px at 55°N).
  // Terrarium tiles go up to z=15 globally. Formula: z+7 clamped to [12,15].
  const terrZ = Math.min(15, Math.max(12, z + 7));
  const terrN = 1 << terrZ;

  // 1. Compute BNG tile bounds
  const tileM = SIZE * OS_PROJECTION.resolutions[z];
  const bngWest = OS_PROJECTION.origin[0] + x * tileM;
  const bngNorth = OS_PROJECTION.origin[1] - y * tileM;
  const bngEast = bngWest + tileM;
  const bngSouth = bngNorth - tileM;

  // 2. Project 4 corners BNG → WGS84
  const [nwLng, nwLat] = proj4('EPSG:27700', 'EPSG:4326', [bngWest, bngNorth]);
  const [neLng, neLat] = proj4('EPSG:27700', 'EPSG:4326', [bngEast, bngNorth]);
  const [swLng, swLat] = proj4('EPSG:27700', 'EPSG:4326', [bngWest, bngSouth]);
  const [seLng, seLat] = proj4('EPSG:27700', 'EPSG:4326', [bngEast, bngSouth]);

  // 3. Find terrarium pixel coords for each OS tile corner
  const [nwTpx, nwTpy] = lngLatToTerrPx(nwLng, nwLat, terrN);
  const [neTpx, neTpy] = lngLatToTerrPx(neLng, neLat, terrN);
  const [swTpx, swTpy] = lngLatToTerrPx(swLng, swLat, terrN);
  const [seTpx, seTpy] = lngLatToTerrPx(seLng, seLat, terrN);

  // Find the bounding terrarium tile range (add 1 tile margin for gradient at edges)
  const allTpx = [nwTpx, neTpx, swTpx, seTpx];
  const allTpy = [nwTpy, neTpy, swTpy, seTpy];
  const txMin = Math.max(0, Math.floor(Math.min(...allTpx) / SIZE) - 1);
  const txMax = Math.min(terrN - 1, Math.floor(Math.max(...allTpx) / SIZE) + 1);
  const tyMin = Math.max(0, Math.floor(Math.min(...allTpy) / SIZE) - 1);
  const tyMax = Math.min(terrN - 1, Math.floor(Math.max(...allTpy) / SIZE) + 1);

  // 4. Fetch all needed terrarium tiles in parallel
  const tileMap = new Map<string, Float32Array | null>();
  const fetchPromises: Promise<void>[] = [];
  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      fetchPromises.push(
        fetchTerrElev(terrZ, tx, ty).then(e => { tileMap.set(`${tx},${ty}`, e); })
      );
    }
  }
  await Promise.all(fetchPromises);

  // Bilinear interpolation of elevation at fractional terrarium pixel coordinates
  function getElev(tpx: number, tpy: number): number {
    const x0 = Math.floor(tpx);
    const y0 = Math.floor(tpy);
    const fx = tpx - x0;
    const fy = tpy - y0;

    function sample(px: number, py: number): number {
      const tileX = Math.floor(px / SIZE);
      const tileY = Math.floor(py / SIZE);
      const elev = tileMap.get(`${tileX},${tileY}`);
      if (!elev) return 0;
      const lx = Math.max(0, Math.min(SIZE - 1, px - tileX * SIZE));
      const ly = Math.max(0, Math.min(SIZE - 1, py - tileY * SIZE));
      return elev[ly * SIZE + lx];
    }

    return (
      sample(x0,     y0)     * (1 - fx) * (1 - fy) +
      sample(x0 + 1, y0)     * fx       * (1 - fy) +
      sample(x0,     y0 + 1) * (1 - fx) * fy       +
      sample(x0 + 1, y0 + 1) * fx       * fy
    );
  }

  // 5. Affine mapping from OS pixel (col, row) → terrarium pixel (tpx, tpy)
  // Using 3 corners (NW, NE, SW) to define the affine transform
  const duTpx = (neTpx - nwTpx) / (SIZE - 1); // terrarium x step per OS column pixel
  const duTpy = (neTpy - nwTpy) / (SIZE - 1); // terrarium y step per OS column pixel
  const dvTpx = (swTpx - nwTpx) / (SIZE - 1); // terrarium x step per OS row pixel
  const dvTpy = (swTpy - nwTpy) / (SIZE - 1); // terrarium y step per OS row pixel

  // Physical cell size in metres per OS pixel (BNG resolution)
  const cellSizeM = OS_PROJECTION.resolutions[z];

  const out = Buffer.alloc(SIZE * SIZE * 4);

  // 6. Compute hillshade for each OS output pixel
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const tpx = nwTpx + col * duTpx + row * dvTpx;
      const tpy = nwTpy + col * duTpy + row * dvTpy;

      // Sample DEM at ±1 OS pixel in east/south directions for gradient
      const elevE = getElev(tpx + duTpx, tpy + duTpy);
      const elevW = getElev(tpx - duTpx, tpy - duTpy);
      const elevS = getElev(tpx + dvTpx, tpy + dvTpy); // row+1 = south
      const elevN = getElev(tpx - dvTpx, tpy - dvTpy); // row-1 = north

      const dzdx = (elevE - elevW) / (2 * cellSizeM);
      const dzdy = -(elevS - elevN) / (2 * cellSizeM); // negate: BNG northing increases upward

      const nx = -dzdx * Z_FACTOR;
      const ny = -dzdy * Z_FACTOR;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      const hillshade = Math.max(0, (nx / len) * Lx + (ny / len) * Ly + (nz / len) * Lz);

      const idx = (row * SIZE + col) * 4;
      if (dark) {
        out[idx]     = 255;
        out[idx + 1] = 255;
        out[idx + 2] = 255;
        out[idx + 3] = Math.round((1 - hillshade) * 0.22 * 255);
      } else {
        out[idx]     = 30;
        out[idx + 1] = 22;
        out[idx + 2] = 10;
        out[idx + 3] = Math.round((1 - hillshade) * 0.35 * 255);
      }
    }
  }

  // 7. Return RGBA PNG
  const png = await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
