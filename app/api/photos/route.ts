import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPremiumBackendConfig } from '@/lib/backend';

export async function GET(request: NextRequest) {
  const session = await getSession();
  const backend = getPremiumBackendConfig(session);

  if (!backend) {
    return new NextResponse(null, { status: 404 });
  }

  // Forward all provided query params to the backend unchanged.
  // When no bbox params are given the backend returns all photos (for client-side clustering).
  const backendUrl = new URL(`${backend.url}/photos`);
  new URL(request.url).searchParams.forEach((value, key) => {
    backendUrl.searchParams.set(key, value);
  });

  try {
    const res = await fetch(backendUrl.toString(), {
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
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
