import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActivityDetail, refreshTokenIfNeeded, StravaApiError } from '@/lib/strava';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (await refreshTokenIfNeeded(session)) {
    await session.save();
  }

  try {
    const activity = await getActivityDetail(session.accessToken, id);
    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof StravaApiError) {
      return NextResponse.json({ error: 'Strava API error' }, { status: error.status });
    }
    throw error;
  }
}
