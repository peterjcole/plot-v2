import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { refreshTokenIfNeeded, getAthleteActivities } from '@/lib/strava';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (await refreshTokenIfNeeded(session)) {
    await session.save();
  }

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(request.nextUrl.searchParams.get('perPage') || '20', 10) || 20));

  const activities = await getAthleteActivities(session.accessToken, page, perPage);

  return NextResponse.json(activities);
}
