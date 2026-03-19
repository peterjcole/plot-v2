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
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${tilesBackendUrl}/tiles/activities?lat=${lat}&lng=${lng}`, {
      headers: {
        Authorization: `Bearer ${tilesBearerToken}`,
        'X-Athlete-Id': String(session.athlete!.id),
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
