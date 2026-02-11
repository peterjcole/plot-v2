import { NextRequest, NextResponse } from 'next/server';

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
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { coordinates: [], error: 'Elevation service not configured' },
      { status: 503 }
    );
  }

  let body: { coordinates: [number, number][] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { coordinates: [], error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.coordinates) || body.coordinates.length < 2) {
    return NextResponse.json(
      { coordinates: [], error: 'Need at least 2 coordinates' },
      { status: 400 }
    );
  }

  try {
    const sampled = downsample(body.coordinates, MAX_COORDS);
    console.log(`Elevation API: ${body.coordinates.length} input coords, ${sampled.length} after downsample`);

    const res = await fetch(
      'https://api.openrouteservice.org/elevation/line',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify({
          format_in: 'polyline',
          format_out: 'polyline',
          geometry: sampled,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('ORS Elevation API error:', res.status, text);
      return NextResponse.json(
        { coordinates: [], error: 'Elevation service error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const coords = data.geometry;

    if (!Array.isArray(coords)) {
      return NextResponse.json(
        { coordinates: [], error: 'Unexpected response format' },
        { status: 502 }
      );
    }

    console.log(`Elevation API: ${coords.length} coords returned from ORS`);

    // ORS returns [lng, lat, ele]
    const coordinates = coords.map((c: number[]) => ({
      lat: c[1],
      lng: c[0],
      ele: c[2] ?? 0,
    }));

    return NextResponse.json(
      { coordinates },
      { headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (err) {
    console.error('ORS elevation fetch error:', err);
    return NextResponse.json(
      { coordinates: [], error: 'Elevation service unavailable' },
      { status: 502 }
    );
  }
}
