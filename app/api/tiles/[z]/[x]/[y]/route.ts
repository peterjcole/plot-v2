import { NextRequest, NextResponse } from 'next/server';
import { getSession, backendFetch } from '@/lib/auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  const session = await getSession();

  if (!session.jwt) {
    return new NextResponse(null, { status: 401 });
  }

  const { z, x, y } = await params;

  try {
    const res = await backendFetch(`/tiles/${z}/${x}/${y}`, session.jwt);

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
