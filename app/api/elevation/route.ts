import { NextRequest, NextResponse } from 'next/server';
import { fetchTerrElev, lngLatToTerrPx, sampleElevation } from '@/lib/dem';

const MAX_COORDS = 2000;
const TERR_Z = 13; // ≈11 m/px at UK latitudes — better than ORS SRTM ~30 m
const TILE_SIZE = 256;

/** Downsample a coordinate array to at most `max` points, always keeping first and last. */
function downsample(coords: [number, number][], max: number): [number, number][] {
  if (coords.length <= max) return coords;
  const result: [number, number][] = [coords[0]];
  const step = (coords.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

export async function POST(request: NextRequest) {
  let body: { coordinates: [number, number][] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ coordinates: [], error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.coordinates) || body.coordinates.length < 2) {
    return NextResponse.json({ coordinates: [], error: 'Need at least 2 coordinates' }, { status: 400 });
  }

  try {
    const sampled = downsample(body.coordinates, MAX_COORDS);
    const terrN = 1 << TERR_Z;

    // Collect the distinct set of DEM tiles the polyline crosses, including bilinear neighbours
    const tileSet = new Set<string>();
    for (const [lng, lat] of sampled) {
      const [px, py] = lngLatToTerrPx(lng, lat, terrN);
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(py / TILE_SIZE);
      tileSet.add(`${tx},${ty}`);
      tileSet.add(`${tx + 1},${ty}`);
      tileSet.add(`${tx},${ty + 1}`);
      tileSet.add(`${tx + 1},${ty + 1}`);
    }

    // Fetch all needed tiles in parallel (fetchTerrElev is module-level cache-backed)
    const tileEntries = await Promise.all(
      [...tileSet].map(async (k) => {
        const [x, y] = k.split(',').map(Number);
        const data = await fetchTerrElev(TERR_Z, x, y);
        return [`${TERR_Z}/${x}/${y}`, data] as [string, Float32Array | null];
      })
    );
    const tiles = new Map<string, Float32Array | null>(tileEntries);

    const coordinates = sampled.map(([lng, lat]) => ({
      lat,
      lng,
      ele: sampleElevation(lng, lat, TERR_Z, tiles),
    }));

    return NextResponse.json(
      { coordinates },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (err) {
    console.error('Elevation DEM fetch error:', err);
    return NextResponse.json({ coordinates: [], error: 'Elevation service unavailable' }, { status: 502 });
  }
}
