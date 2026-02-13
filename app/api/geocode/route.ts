import { NextRequest, NextResponse } from 'next/server';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    county?: string;
    state?: string;
    country?: string;
    type?: string;
  };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', q);
    url.searchParams.set('bbox', '-10.5,49.5,2.5,61.0');
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'en');

    const res = await fetch(url.toString());

    if (!res.ok) {
      return NextResponse.json(
        { results: [], error: 'Geocoding service error' },
        { status: 502 }
      );
    }

    const data = await res.json();

    const results = (data.features ?? []).map((f: PhotonFeature) => ({
      name: f.properties.name ?? '',
      region: f.properties.county || f.properties.state || f.properties.country || '',
      type: f.properties.type ?? '',
      coordinates: f.geometry.coordinates as [number, number],
    }));

    return NextResponse.json(
      { results },
      {
        headers: { 'Cache-Control': 'public, max-age=300' },
      }
    );
  } catch (err) {
    console.error('Geocode fetch error:', err);
    return NextResponse.json(
      { results: [], error: 'Geocoding service unavailable' },
      { status: 502 }
    );
  }
}
