import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const minLat = searchParams.get('minLat');
  const maxLat = searchParams.get('maxLat');
  const minLng = searchParams.get('minLng');
  const maxLng = searchParams.get('maxLng');
  const limit = searchParams.get('limit') ?? '300';

  if (!minLat || !maxLat || !minLng || !maxLng) {
    return NextResponse.json({ error: 'minLat, maxLat, minLng, maxLng required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${tilesBackendUrl}/photos?minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${tilesBearerToken}`,
          'X-Athlete-Id': tilesAthleteId,
        },
      },
    );

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
