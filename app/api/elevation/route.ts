import { NextRequest, NextResponse } from 'next/server';
import { sampleElevationsForCoords } from '@/lib/dem';

const MAX_COORDS = 2000;

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
    const points = sampled.map(([lng, lat]) => ({ lat, lng }));
    const elevations = await sampleElevationsForCoords(points);
    const coordinates = points.map((p, i) => ({ ...p, ele: elevations[i] }));

    return NextResponse.json(
      { coordinates },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (err) {
    console.error('Elevation DEM fetch error:', err);
    return NextResponse.json({ coordinates: [], error: 'Elevation service unavailable' }, { status: 502 });
  }
}
