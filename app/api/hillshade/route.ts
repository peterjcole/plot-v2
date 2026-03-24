import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const SIZE = 256;

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
  const z = parseInt(searchParams.get('z') ?? '8', 10);
  const x = parseInt(searchParams.get('x') ?? '0', 10);
  const y = parseInt(searchParams.get('y') ?? '0', 10);
  const dark = searchParams.get('dark') === '1';
  const zFactor = 3.5;
  const sunAz = 315 * (Math.PI / 180);
  const sunAlt = 35 * (Math.PI / 180);

  // Fetch main tile + 4 neighbours in parallel for seamless cross-tile gradients
  const [elevMain, elevN, elevS, elevW, elevE] = await Promise.all([
    fetchTerrElev(z, x, y),
    fetchTerrElev(z, x, y - 1),  // north (row above)
    fetchTerrElev(z, x, y + 1),  // south (row below)
    fetchTerrElev(z, x - 1, y),  // west  (col left)
    fetchTerrElev(z, x + 1, y),  // east  (col right)
  ]);

  if (!elevMain) return emptyPng();

  // Build a 258×258 extended elevation grid so edge pixels read real neighbour data
  const EXT = SIZE + 2;
  const elevExt = new Float32Array(EXT * EXT);

  const mainElev = elevMain; // narrowed to non-null after the early return above
  function clampedMain(r: number, c: number): number {
    return mainElev[Math.max(0, Math.min(SIZE - 1, r)) * SIZE + Math.max(0, Math.min(SIZE - 1, c))];
  }

  for (let row = 0; row < EXT; row++) {
    for (let col = 0; col < EXT; col++) {
      const mr = row - 1; // corresponding row in main tile (-1..256)
      const mc = col - 1; // corresponding col in main tile (-1..256)
      let e: number;

      if (mr >= 0 && mr < SIZE && mc >= 0 && mc < SIZE) {
        e = mainElev[mr * SIZE + mc];
      } else if (mr === -1 && mc >= 0 && mc < SIZE) {
        e = elevN ? elevN[255 * SIZE + mc] : clampedMain(0, mc);
      } else if (mr === SIZE && mc >= 0 && mc < SIZE) {
        e = elevS ? elevS[0 * SIZE + mc] : clampedMain(SIZE - 1, mc);
      } else if (mc === -1 && mr >= 0 && mr < SIZE) {
        e = elevW ? elevW[mr * SIZE + 255] : clampedMain(mr, 0);
      } else if (mc === SIZE && mr >= 0 && mr < SIZE) {
        e = elevE ? elevE[mr * SIZE + 0] : clampedMain(mr, SIZE - 1);
      } else {
        e = clampedMain(mr, mc); // corners — clamp
      }

      elevExt[row * EXT + col] = e;
    }
  }

  // Physical cell size in metres at tile centre latitude
  const n = 1 << z;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y + 1) / n)));
  const R = 6378137;
  const cellSizeM = (2 * Math.PI * R * Math.cos(latRad)) / (SIZE * n);

  // Sun direction vector
  const Lx = Math.sin(sunAz) * Math.cos(sunAlt);
  const Ly = Math.cos(sunAz) * Math.cos(sunAlt);
  const Lz = Math.sin(sunAlt);

  const out = Buffer.alloc(SIZE * SIZE * 4);

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      // In the extended grid, main tile (row, col) lives at (row+1, col+1)
      const er = row + 1;
      const ec = col + 1;

      const dzdx = (elevExt[er * EXT + ec + 1] - elevExt[er * EXT + ec - 1]) / (2 * cellSizeM);
      const dzdy = -(elevExt[(er + 1) * EXT + ec] - elevExt[(er - 1) * EXT + ec]) / (2 * cellSizeM);

      const nx = -dzdx * zFactor;
      const ny = -dzdy * zFactor;
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

  const png = await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png().toBuffer();

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
