import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const session = await getSession();
  const tilesAthleteId = process.env.TILES_ATHLETE_ID;
  const tilesBackendUrl = process.env.TILES_BACKEND_URL;
  const tilesBearerToken = process.env.TILES_BEARER_TOKEN;

  if (!tilesAthleteId || !tilesBackendUrl || !tilesBearerToken) {
    return new NextResponse(null, { status: 404 });
  }

  if (String(session.athlete?.id) !== tilesAthleteId) {
    return new NextResponse(null, { status: 404 });
  }

  const { z, x, y } = await params;

  try {
    const res = await fetch(`${tilesBackendUrl}/tiles/${z}/${x}/${y}`, {
      headers: {
        Authorization: `Bearer ${tilesBearerToken}`,
        'X-Athlete-Id': String(session.athlete!.id),
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const buffer = await res.arrayBuffer();

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.mapbox-vector-tile',
    };

    const cacheControl = res.headers.get('Cache-Control');
    if (cacheControl) {
      headers['Cache-Control'] = cacheControl;
    }

    return new NextResponse(Buffer.from(buffer), { headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
