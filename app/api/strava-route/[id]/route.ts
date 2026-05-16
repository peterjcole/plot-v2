import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { refreshTokenIfNeeded, decodePolyline, StravaApiError } from '@/lib/strava';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  if (await refreshTokenIfNeeded(session)) {
    await session.save();
  }

  let stravaRes: Response;
  try {
    stravaRes = await fetch(`https://www.strava.com/api/v3/routes/${id}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
  } catch {
    return NextResponse.json({ error: 'network_error' }, { status: 502 });
  }

  if (stravaRes.status === 401 || stravaRes.status === 403) {
    return NextResponse.json({ error: 'insufficient_scope' }, { status: 403 });
  }

  if (stravaRes.status === 404) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (!stravaRes.ok) {
    throw new StravaApiError(stravaRes.status);
  }

  const json = await stravaRes.json();
  const encoded = json.map?.polyline ?? json.map?.summary_polyline;

  if (!encoded) {
    return NextResponse.json({ error: 'no_polyline' }, { status: 422 });
  }

  const points = decodePolyline(encoded);

  return NextResponse.json({
    name: json.name as string,
    distance: json.distance as number,
    points,
  });
}
