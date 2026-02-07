import { getSession } from '@/lib/auth';
import LoginButton from '@/app/components/LoginButton';
import ActivityList from '@/app/components/ActivityList';

export default async function Home() {
  const session = await getSession();
  const isLoggedIn = !!session.accessToken;

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-4xl px-6 py-12">
        {isLoggedIn ? (
          <>
            <div className="mb-8 flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                Activities
              </h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {session.athlete?.firstname} {session.athlete?.lastname}
                </span>
                <form action="/api/auth/logout" method="POST" className="inline">
                  <button
                    type="submit"
                    className="text-sm font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-300"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </div>
            <ActivityList />
          </>
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              Plot
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Generate printout screenshots of your Strava activities
            </p>
            <LoginButton />
          </div>
        )}
      </main>
    </div>
  );
}
