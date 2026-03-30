import { NextRequest, NextResponse } from 'next/server';

const EMPTY = { type: 'FeatureCollection', features: [] };

export async function GET(request: NextRequest) {
  const bbox = request.nextUrl.searchParams.get('bbox');
  if (!bbox) return NextResponse.json(EMPTY);

  const apiKey = process.env.OS_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json(EMPTY);

  try {
    // wtr-fts-waterpoint-1: OS NGD Water Point features (waterfalls, springs, etc.)
    // CQL filter restricts to waterfall description type from the waterpointdescriptionvalue code list.
    const url = new URL('https://api.os.uk/features/ngd/ofa/v1/collections/wtr-fts-waterpoint-1/items');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('bbox', bbox);
    url.searchParams.set('limit', '100');
    url.searchParams.set('filter', "description='Waterfall'");

    const res = await fetch(url.toString());
    if (!res.ok) return NextResponse.json(EMPTY);

    const data = await res.json() as {
      features?: Array<{
        type: string;
        geometry: unknown;
        properties: Record<string, unknown>;
      }>;
    };

    const features = (data.features ?? []).map((f) => ({
      ...f,
      properties: { ...f.properties, poiType: 'waterfall' },
    }));

    return NextResponse.json(
      { type: 'FeatureCollection', features },
      { headers: { 'Cache-Control': 'public, max-age=86400' } }
    );
  } catch {
    return NextResponse.json(EMPTY);
  }
}
