import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAthleteActivities, StravaApiError } from '@/lib/strava';
import { hasPremium } from '@/lib/entitlements';
import MapShell, { type PanelMode } from '@/app/components/shell/MapShell';
import { ActivitySummary } from '@/lib/types';


export default async function Home({ searchParams }: { searchParams: Promise<{ mode?: string; activity?: string; route?: string }> }) {
  const { mode, activity, route } = await searchParams;
  const initialMode: PanelMode = mode === 'planner' ? 'planner' : mode === 'about' ? 'about' : 'browse';
  const initialSelectedId = activity ?? null;
  const initialRouteId = route ?? null;
  const session = await getSession();
  const isLoggedIn = !!session.accessToken;

  if (isLoggedIn) {
    // eslint-disable-next-line react-hooks/purity -- server component, Date.now() is safe
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

  const isPremium = hasPremium(session);

  return (
    <MapShell
      activities={activities}
      avatarInitials={avatarInitials}
      isLoggedIn={isLoggedIn}
      isPremium={isPremium}
      initialMode={initialMode}
      initialSelectedId={initialSelectedId}
      initialRouteId={initialRouteId}
      authError={authError}
    />
  );
}
