import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPremiumBackendConfig } from '@/lib/backend';

export async function GET(request: NextRequest) {
  const session = await getSession();
  const backend = getPremiumBackendConfig(session);

  if (!backend) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filter = request.nextUrl.searchParams.get('filter') || 'all';

  try {
    const res = await fetch(`${backend.url}/explorer?filter=${encodeURIComponent(filter)}`, {
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch explorer data' }, { status: 502 });
  }
}
