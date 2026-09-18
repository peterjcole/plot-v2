import { NextRequest, NextResponse } from 'next/server';
import { getMobileBackendConfig } from '@/lib/mobile-auth';

// Forwards a beacon create (multipart/form-data: meta JSON + optional gpx
// file) straight through to plot-backend's POST /beacon — mirrors
// app/api/mobile/uploads/route.ts's proxy shape exactly. plot-backend does
// the idempotency-by-client-id handling, GPX storage, and email send; this
// is a pure pass-through, same as every other mobile proxy.
export async function POST(request: NextRequest) {
  const backend = await getMobileBackendConfig(request);
  if (!backend) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.formData();
    const res = await fetch(`${backend.url}/beacon`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
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
