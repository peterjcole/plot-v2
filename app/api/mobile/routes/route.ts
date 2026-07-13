import { NextRequest, NextResponse } from 'next/server';
import { getMobileBackendConfig } from '@/lib/mobile-auth';

export async function GET(request: NextRequest) {
  const backend = await getMobileBackendConfig(request);
  if (!backend) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${backend.url}/routes`, {
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
