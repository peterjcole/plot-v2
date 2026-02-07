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

  const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
  const perPage = parseInt(request.nextUrl.searchParams.get('perPage') || '20', 10);

  const activities = await getAthleteActivities(session.accessToken, page, perPage);

  return NextResponse.json(activities);
}
