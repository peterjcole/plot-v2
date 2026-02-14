import { getSession } from '@/lib/auth';
import { getAthleteActivities } from '@/lib/strava';
import LoginButton from '@/app/components/LoginButton';
import ActivityList from '@/app/components/ActivityList';

export default async function Home() {
  const session = await getSession();
  const isLoggedIn = !!session.accessToken;

  let initialActivities: Awaited<ReturnType<typeof getAthleteActivities>> = [];
  if (isLoggedIn) {
    initialActivities = await getAthleteActivities(session.accessToken!, 1, 20);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface font-sans">
      <main className="w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {isLoggedIn ? (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-semibold text-text-primary">
                Activities
              </h1>
              <div className="flex items-center gap-4">
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
              </div>
            </div>
            <ActivityList initialActivities={initialActivities} />
          </>
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
            <h1 className="text-3xl font-semibold text-text-primary">
              Plot
            </h1>
            <p className="text-lg text-text-secondary">
              Generate printout screenshots of your Strava activities
            </p>
            <LoginButton />
          </div>
        )}
      </main>
    </div>
  );
}
