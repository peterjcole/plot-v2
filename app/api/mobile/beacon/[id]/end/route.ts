import { NextRequest, NextResponse } from 'next/server';
import { getMobileBackendConfig } from '@/lib/mobile-auth';

// Forwards the end-of-workout marker straight through to plot-backend's
// POST /beacon/:id/end, which sets ended_at/expires_at (the public share
// page's staleness/expiry window is anchored on this).
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
    const res = await fetch(`${backend.url}/beacon/${encodeURIComponent(id)}/end`, {
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
