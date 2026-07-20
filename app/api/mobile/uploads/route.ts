import { NextRequest, NextResponse } from 'next/server';
import { getMobileBackendConfig } from '@/lib/mobile-auth';

// Forwards a GPX export (multipart/form-data: file, name, external_id,
// activity_type, description) from the phone straight through to
// plot-backend's POST /uploads, which does the actual Strava upload —
// mirrors app/api/mobile/routes/route.ts's proxy shape. Strava's upload is
// asynchronous: the response here is just the upload id/status, not a
// finished activity; the client polls GET /api/mobile/uploads/[id].
export async function POST(request: NextRequest) {
  const backend = await getMobileBackendConfig(request);
  if (!backend) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.formData();
    const res = await fetch(`${backend.url}/uploads`, {
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
