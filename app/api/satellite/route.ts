import { NextRequest, NextResponse } from 'next/server';
import { stitchRetinaTile } from '@/lib/tile-stitch';

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
  sessionCache = { token: data.session, expiry: parseInt(data.expiry, 10) * 1000 };
  return data.session;
}

async function fetchTileBuffer(z: number, x: number, y: number): Promise<Buffer | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const token = await getSessionToken();
    let tileRes = await fetch(
      `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${token}&key=${apiKey}`
    );

    if ((tileRes.status === 401 || tileRes.status === 403) && sessionCache) {
      sessionCache = null;
      const newToken = await getSessionToken();
      tileRes = await fetch(
        `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${newToken}&key=${apiKey}`
      );
    }

    if (!tileRes.ok) return null;
    return Buffer.from(await tileRes.arrayBuffer());
  } catch {
    return null;
  }
}

const CACHE = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');

  if (!z || !x || !y) {
    return new NextResponse('Missing tile coordinates', { status: 400 });
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return new NextResponse('Satellite tiles not configured', { status: 503 });
  }

  try {
    if (searchParams.get('scale') === '2') {
      const buf = await stitchRetinaTile(fetchTileBuffer, parseInt(z, 10), parseInt(x, 10), parseInt(y, 10));
      return new NextResponse(new Uint8Array(buf), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE },
      });
    }

    const buf = await fetchTileBuffer(parseInt(z, 10), parseInt(x, 10), parseInt(y, 10));
    if (!buf) return new NextResponse('Tile fetch failed', { status: 502 });

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': CACHE,
      },
    });
  } catch (err) {
    console.error('Satellite tile error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
