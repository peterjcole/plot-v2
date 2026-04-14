import { NextRequest, NextResponse } from 'next/server';

const CACHE = 'public, max-age=1209600, s-maxage=1209600';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const xStr = sp.get('x');
  const yStr = sp.get('y');
  const zStr = sp.get('z');

  if (!xStr || !yStr || !zStr) {
    return NextResponse.json({ error: 'x, y, and z query parameters are required' }, { status: 400 });
  }

  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);
  const z = parseInt(zStr, 10);

  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    return NextResponse.json({ error: 'x, y, and z must be integers' }, { status: 400 });
  }

  const apiKey = process.env.OS_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OS_MAPS_API_KEY not configured' }, { status: 500 });
  }

  // OGC API Tiles convention: {tileMatrix}/{tileRow}/{tileCol} = {z}/{y}/{x}
  const url = `https://api.os.uk/maps/vector/ngd/ota/v1/collections/ngd-base/tiles/3857/${z}/${y}/${x}?key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Return empty body with 204 for tiles outside coverage rather than propagating errors
      if (response.status === 404 || response.status === 204) {
        return new NextResponse(null, { status: 204 });
      }
      return new NextResponse(null, { status: response.status });
    }

    const data = await response.arrayBuffer();
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.mapbox-vector-tile',
        'Cache-Control': CACHE,
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
