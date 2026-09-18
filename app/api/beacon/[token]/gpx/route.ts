import { NextRequest, NextResponse } from 'next/server';

// Public GPX download for the tracking page — see app/api/beacon/[token]/route.ts
// for why this carries no auth. Streams plot-backend's response straight
// through rather than buffering, and forwards its Content-Disposition so
// the filename plot-backend chose (from the route name) survives the proxy.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const backendUrl = process.env.TILES_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${backendUrl}/b/${encodeURIComponent(token)}/gpx`, { cache: 'no-store' });
    if (!res.ok || !res.body) {
      return new NextResponse(null, { status: res.status || 502 });
    }
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/gpx+xml',
        'Content-Disposition': res.headers.get('content-disposition') || 'attachment; filename="route.gpx"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
