import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPremiumBackendConfig } from '@/lib/backend';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const session = await getSession();
  const backend = getPremiumBackendConfig(session);

  if (!backend) {
    return new NextResponse(null, { status: 404 });
  }

  const { z, x, y } = await params;

  try {
    const res = await fetch(`${backend.url}/tiles/${z}/${x}/${y}`, {
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const buffer = await res.arrayBuffer();

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.mapbox-vector-tile',
    };

    const cacheControl = res.headers.get('Cache-Control');
    if (cacheControl) {
      headers['Cache-Control'] = cacheControl;
    }

    return new NextResponse(Buffer.from(buffer), { headers });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
