import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPremiumBackendConfig } from '@/lib/backend';

export async function GET() {
  const session = await getSession();
  const backend = getPremiumBackendConfig(session);

  if (!backend) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const res = await fetch(`${backend.url}/tiles/meta`, {
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
      },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tile metadata' }, { status: 502 });
  }
}
