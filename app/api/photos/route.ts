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

  // Forward all provided query params to the backend unchanged.
  // When no bbox params are given the backend returns all photos (for client-side clustering).
  const backendUrl = new URL(`${tilesBackendUrl}/photos`);
  new URL(request.url).searchParams.forEach((value, key) => {
    backendUrl.searchParams.set(key, value);
  });

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: {
        Authorization: `Bearer ${tilesBearerToken}`,
        'X-Athlete-Id': tilesAthleteId,
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
