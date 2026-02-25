import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Map, Mountain } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getAthleteActivities, StravaApiError } from '@/lib/strava';
import Header from '@/app/components/Header';
import LoginButton from '@/app/components/LoginButton';
import ActivityList from '@/app/components/ActivityList';

export default async function Home() {
  const session = await getSession();
  const isLoggedIn = !!session.accessToken;

  let initialActivities: Awaited<ReturnType<typeof getAthleteActivities>> = [];
  let activitiesError = false;
  if (isLoggedIn) {
    try {
      initialActivities = await getAthleteActivities(session.accessToken!, 1, 20);
    } catch (error) {
      if (error instanceof StravaApiError && error.status === 401) {
        const now = Math.floor(Date.now() / 1000);
        const isExpired = session.expiresAt !== undefined && session.expiresAt <= now;
        if (isExpired && session.refreshToken) {
          redirect('/api/auth/refresh?next=/');
        }
        redirect('/api/auth/logout');
      }
      activitiesError = true;
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface font-sans">
      <main className="w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Header logo="lg">
          {isLoggedIn && (
            <>
              <span className="text-sm text-text-secondary">
                {session.athlete?.firstname} {session.athlete?.lastname}
              </span>
              <form action="/api/auth/logout" method="POST" className="contents">
                <button
                  type="submit"
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  Log out
                </button>
              </form>
            </>
          )}
        </Header>

        {/* Planner promo banner */}
        <div className="mt-8 rounded-lg border border-accent p-5">
          <div className="flex items-start gap-4">
            <Map className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
            <div>
              <h2 className="text-base font-semibold text-text-primary">Route Planner</h2>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                Plan walking and cycling routes on Ordnance Survey maps. Snap to
                paths, view elevation profiles, and export your routes. No login
                required.
              </p>
              <Link
                href="/planner"
                className="mt-3 inline-block text-sm font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Open planner &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Strava login promo banner (logged-out only) */}
        {!isLoggedIn && (
          <div className="mt-4 rounded-lg border border-primary p-5">
            <div className="flex items-start gap-4">
              <Mountain className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h2 className="text-base font-semibold text-text-primary">Strava Activities</h2>
                <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                  Login with Strava to visualise your recent activities on an OS Map.
                </p>
                <div className="mt-3">
                  <LoginButton />
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoggedIn && activitiesError && (
          <div className="mt-8 rounded-lg border border-red-300 bg-red-50 p-5">
            <p className="text-sm text-red-800">
              Unable to load activities from Strava. This may be a temporary issue &mdash; try refreshing the page.
            </p>
          </div>
        )}

        {isLoggedIn && !activitiesError && (
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-text-primary">Activities</h2>
            <ActivityList initialActivities={initialActivities} />
          </div>
        )}
      </main>
    </div>
  );
}
