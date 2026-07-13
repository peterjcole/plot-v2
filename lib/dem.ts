import sharp from 'sharp';

const TILE_SIZE = 256;
const CACHE_MAX = 256;

const tileCache = new Map<string, Float32Array | null>();

/** Fetch and decode a terrarium-encoded DEM tile to a 256×256 Float32 elevation grid (metres). */
export async function fetchTerrElev(z: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key)!;

  let elev: Float32Array | null = null;
  try {
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      elev = new Float32Array(TILE_SIZE * TILE_SIZE);
      for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
        elev[i] = data[i * 4] * 256 + data[i * 4 + 1] + data[i * 4 + 2] / 256 - 32768;
      }
    }
  } catch {
    elev = null;
  }

  if (tileCache.size >= CACHE_MAX) {
    tileCache.delete(tileCache.keys().next().value!);
  }
  tileCache.set(key, elev);
  return elev;
}

/** Convert WGS84 lon/lat to fractional terrarium pixel coordinates at zoom level terrN = 1 << z. */
export function lngLatToTerrPx(lng: number, lat: number, terrN: number): [number, number] {
  const latRad = lat * (Math.PI / 180);
  const px = ((lng + 180) / 360) * terrN * TILE_SIZE;
  const py = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * terrN * TILE_SIZE;
  return [px, py];
}

/**
 * Bilinearly sample elevation (metres) at the given lon/lat from a map of pre-fetched
 * terrarium tiles at zoom `z`. Returns 0 for any missing tile.
 */
export function sampleElevation(lng: number, lat: number, z: number, tiles: Map<string, Float32Array | null>): number {
  const terrN = 1 << z;
  const [tpx, tpy] = lngLatToTerrPx(lng, lat, terrN);

  const x0 = Math.floor(tpx);
  const y0 = Math.floor(tpy);
  const fx = tpx - x0;
  const fy = tpy - y0;

  function sample(px: number, py: number): number {
    const tileX = Math.floor(px / TILE_SIZE);
    const tileY = Math.floor(py / TILE_SIZE);
    const key = `${z}/${tileX}/${tileY}`;
    const elev = tiles.get(key);
    if (!elev) return 0;
    const lx = Math.max(0, Math.min(TILE_SIZE - 1, px - tileX * TILE_SIZE));
    const ly = Math.max(0, Math.min(TILE_SIZE - 1, py - tileY * TILE_SIZE));
    return elev[ly * TILE_SIZE + lx];
  }

  return (
    sample(x0,     y0)     * (1 - fx) * (1 - fy) +
    sample(x0 + 1, y0)     * fx       * (1 - fy) +
    sample(x0,     y0 + 1) * (1 - fx) * fy       +
    sample(x0 + 1, y0 + 1) * fx       * fy
  );
}

export const DEFAULT_TERR_Z = 13; // ≈11 m/px at UK latitudes — better than ORS SRTM ~30 m

/** Bilinearly sample elevation (meters) for each coordinate, fetching (and caching) only the DEM tiles they cross. */
export async function sampleElevationsForCoords(
  coords: { lat: number; lng: number }[],
  z = DEFAULT_TERR_Z,
): Promise<number[]> {
  const terrN = 1 << z;

  // Collect the distinct set of DEM tiles the polyline crosses, including bilinear neighbours
  const tileSet = new Set<string>();
  for (const { lng, lat } of coords) {
    const [px, py] = lngLatToTerrPx(lng, lat, terrN);
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    tileSet.add(`${tx},${ty}`);
    tileSet.add(`${tx + 1},${ty}`);
    tileSet.add(`${tx},${ty + 1}`);
    tileSet.add(`${tx + 1},${ty + 1}`);
  }

  const tileEntries = await Promise.all(
    [...tileSet].map(async (k) => {
      const [x, y] = k.split(',').map(Number);
      const data = await fetchTerrElev(z, x, y);
      return [`${z}/${x}/${y}`, data] as [string, Float32Array | null];
    })
  );
  const tiles = new Map<string, Float32Array | null>(tileEntries);

  return coords.map(({ lng, lat }) => sampleElevation(lng, lat, z, tiles));
}
