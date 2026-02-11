import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json(
      { coordinates: [], distance: 0, error: 'Missing from/to parameters' },
      { status: 400 }
    );
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { coordinates: [], distance: 0, error: 'Routing service not configured' },
      { status: 503 }
    );
  }

  const [fromLat, fromLng] = from.split(',').map(Number);
  const [toLat, toLng] = to.split(',').map(Number);

  if ([fromLat, fromLng, toLat, toLng].some(isNaN)) {
    return NextResponse.json(
      { coordinates: [], distance: 0, error: 'Invalid coordinates' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
        },
        body: JSON.stringify({
          coordinates: [
            [fromLng, fromLat],
            [toLng, toLat],
          ],
          elevation: true,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('ORS API error:', res.status, text);
      return NextResponse.json(
        { coordinates: [], distance: 0, error: 'Routing service error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const geometry = data.features?.[0]?.geometry;
    const properties = data.features?.[0]?.properties;

    if (!geometry?.coordinates) {
      return NextResponse.json(
        { coordinates: [], distance: 0, error: 'No route found' },
        { status: 404 }
      );
    }

    // ORS returns [lng, lat, ele] coordinates
    const coordinates = geometry.coordinates.map(
      (coord: number[]) => ({
        lat: coord[1],
        lng: coord[0],
        ...(coord[2] != null ? { ele: coord[2] } : {}),
      })
    );

    const distance = properties?.summary?.distance ?? 0;

    return NextResponse.json(
      { coordinates, distance },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (err) {
    console.error('ORS fetch error:', err);
    return NextResponse.json(
      { coordinates: [], distance: 0, error: 'Routing service unavailable' },
      { status: 502 }
    );
  }
}
