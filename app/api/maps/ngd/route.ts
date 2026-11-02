import { NextRequest, NextResponse } from 'next/server';
import { parseTileParams } from '@/lib/tile-params';

const CACHE = 'public, max-age=1209600, s-maxage=1209600';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tile = parseTileParams(sp);
  if (tile instanceof NextResponse) return tile;
  const { x, y, z } = tile;

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
