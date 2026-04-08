import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAthleteActivities, StravaApiError } from '@/lib/strava';
import MapShell, { type PanelMode } from '@/app/components/shell/MapShell';
import { ActivitySummary } from '@/lib/types';

export default async function Home({ searchParams }: { searchParams: Promise<{ mode?: string; activity?: string }> }) {
  const { mode, activity } = await searchParams;
  const initialMode: PanelMode = mode === 'planner' ? 'planner' : 'browse';
  const initialSelectedId = activity ?? null;
  const session = await getSession();
  const isLoggedIn = !!session.accessToken;

  if (isLoggedIn) {
    const now = Math.floor(Date.now() / 1000);
    const isExpired = session.expiresAt !== undefined && session.expiresAt <= now;
    if (isExpired && session.refreshToken) {
      redirect('/api/auth/refresh?next=/');
    }
  }

  let activities: ActivitySummary[] = [];
  let authError = false;
  if (isLoggedIn && session.accessToken) {
    try {
      activities = await getAthleteActivities(session.accessToken, 1, 50);
    } catch (error) {
      if (error instanceof StravaApiError && error.status === 401) {
        authError = true;
      }
      // Non-fatal — render with empty list (or banner for auth errors)
    }
  }

  const avatarInitials = session.athlete
    ? `${session.athlete.firstname?.[0] ?? ''}${session.athlete.lastname?.[0] ?? ''}`
    : '?';

  const tilesAthleteId = process.env.TILES_ATHLETE_ID;
  const isOwner = !!tilesAthleteId && !!session.athlete && String(session.athlete.id) === tilesAthleteId;

  return (
    <MapShell
      activities={activities}
      avatarInitials={avatarInitials}
      isLoggedIn={isLoggedIn}
      isOwner={isOwner}
      initialMode={initialMode}
      initialSelectedId={initialSelectedId}
      authError={authError}
    />
  );
}
