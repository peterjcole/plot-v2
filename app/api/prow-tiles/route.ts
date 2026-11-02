import { NextRequest, NextResponse } from 'next/server';
import { parseTileParams } from '@/lib/tile-params';

const CACHE = 'public, max-age=7776000, s-maxage=7776000'; // 90 days

// Proxies tile-provider's /prow detail tiles (rights of way, path network, field
// boundaries from the OS NGD Features API). tile-provider only serves z15; the
// client under/overzooms them.
export async function GET(request: NextRequest) {
  const tile = parseTileParams(request.nextUrl.searchParams);
  if (tile instanceof NextResponse) return tile;
  const { x, y, z } = tile;

  const backendUrl = process.env.TILE_PROVIDER_URL;
  const bearerToken = process.env.TILE_PROVIDER_BEARER_TOKEN;
  if (!backendUrl || !bearerToken) {
    return new NextResponse(null, { status: 503 });
  }

  try {
    const res = await fetch(`${backendUrl}/prow/${z}/${x}/${y}.pbf`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 204) return new NextResponse(null, { status: 204 });
      return new NextResponse(null, { status: res.status });
    }

    // tile-provider marks tiles it couldn't fully fetch (OS rate limit, request
    // budget) — don't let a partial tile sit in browser or CDN caches.
    const complete = res.headers.get('X-Prow-Complete') !== 'false';

    // fetch() transparently gunzips the upstream body, so pass it on uncompressed
    return new NextResponse(await res.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.mapbox-vector-tile',
        'Cache-Control': complete ? CACHE : 'no-store',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
