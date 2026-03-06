import { NextRequest, NextResponse } from 'next/server';

let sessionCache: { token: string; expiry: number } | null = null;

async function getSessionToken(): Promise<string> {
  const now = Date.now();
  if (sessionCache && sessionCache.expiry - now > 60_000) {
    return sessionCache.token;
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not set');

  const res = await fetch(
    `https://tile.googleapis.com/v1/createSession?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapType: 'satellite', language: 'en-GB', region: 'GB' }),
    }
  );

  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);

  const data = await res.json();
  // expiry is a Unix timestamp in seconds
  sessionCache = { token: data.session, expiry: parseInt(data.expiry, 10) * 1000 };
  return data.session;
}

async function fetchTile(z: string, x: string, y: string, token: string, apiKey: string): Promise<Response> {
  return fetch(`https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${token}&key=${apiKey}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');

  if (!z || !x || !y) {
    return new NextResponse('Missing tile coordinates', { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return new NextResponse('Satellite tiles not configured', { status: 503 });
  }

  try {
    const token = await getSessionToken();
    let tileRes = await fetchTile(z, x, y, token, apiKey);

    if ((tileRes.status === 401 || tileRes.status === 403) && sessionCache) {
      sessionCache = null;
      const newToken = await getSessionToken();
      tileRes = await fetchTile(z, x, y, newToken, apiKey);
    }

    if (!tileRes.ok) {
      return new NextResponse('Tile fetch failed', { status: tileRes.status });
    }

    const tileBuffer = await tileRes.arrayBuffer();
    const contentType = tileRes.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(tileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('Satellite tile error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
