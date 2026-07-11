import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPremiumBackendConfig } from '@/lib/backend';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  const backend = getPremiumBackendConfig(session);

  if (!backend) {
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const res = await fetch(`${backend.url}/routes/${id}/duplicate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
