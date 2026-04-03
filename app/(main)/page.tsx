import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAthleteActivities, refreshTokenIfNeeded, StravaApiError } from '@/lib/strava';
import MapShell from '@/app/components/shell/MapShell';
import { ActivitySummary } from '@/lib/types';

export default async function Home() {
  const session = await getSession();
  const isLoggedIn = !!session.accessToken;

  if (isLoggedIn) {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = session.expiresAt !== undefined && session.expiresAt <= now;
    if (isExpired && session.refreshToken) {
      redirect('/api/auth/refresh?next=/');
    }
    if (await refreshTokenIfNeeded(session)) {
      await session.save();
    }
  }

  let activities: ActivitySummary[] = [];
  if (isLoggedIn && session.accessToken) {
    try {
      activities = await getAthleteActivities(session.accessToken, 1, 50);
    } catch (error) {
      if (error instanceof StravaApiError && error.status === 401) {
        redirect('/api/auth/logout');
      }
      // Non-fatal — render with empty list
    }
  }

  const avatarInitials = session.athlete
    ? `${session.athlete.firstname?.[0] ?? ''}${session.athlete.lastname?.[0] ?? ''}`
    : '?';

  return (
    <MapShell
      activities={activities}
      avatarInitials={avatarInitials}
    />
  );
}
