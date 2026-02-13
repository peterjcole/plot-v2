import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  const tilesAthleteId = process.env.TILES_ATHLETE_ID;
  const tilesBackendUrl = process.env.TILES_BACKEND_URL;
  const tilesBearerToken = process.env.TILES_BEARER_TOKEN;

  if (!tilesAthleteId || !tilesBackendUrl || !tilesBearerToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (String(session.athlete?.id) !== tilesAthleteId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const res = await fetch(`${tilesBackendUrl}/tiles/meta`, {
      headers: {
        Authorization: `Bearer ${tilesBearerToken}`,
        'X-Athlete-Id': String(session.athlete!.id),
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tile metadata' }, { status: 502 });
  }
}
