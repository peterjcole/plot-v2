import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { refreshTokenIfNeeded, getActivityDetail } from '@/lib/strava';
import ActivityViewClient from './ActivityViewClient';
import DownloadButton from '@/app/components/DownloadButton';

interface ActivityPageProps {
  params: Promise<{ id: string }>;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { id } = await params;
  const session = await getSession();

  if (!session.accessToken) {
    redirect('/');
  }

  if (await refreshTokenIfNeeded(session)) {
    await session.save();
  }

  const activity = await getActivityDetail(session.accessToken, id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              &larr; Back to activities
            </Link>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {activity.name}
            </h1>
          </div>
          <DownloadButton activityId={id} />
        </div>
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <ActivityViewClient activity={activity} />
        </div>
      </div>
    </div>
  );
}
