import { NextRequest, NextResponse } from 'next/server';
import { getMobileBackendConfig } from '@/lib/mobile-auth';

// Forwards a batch of location pings straight through to plot-backend's
// POST /beacon/:id/pings — same proxy shape as the other mobile routes.
// plot-backend's (beacon_id, seq) primary key makes a retried batch a free
// no-op, so this proxy needs no idempotency handling of its own.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const backend = await getMobileBackendConfig(request);
  if (!backend) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.text();
    const res = await fetch(`${backend.url}/beacon/${encodeURIComponent(id)}/pings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
