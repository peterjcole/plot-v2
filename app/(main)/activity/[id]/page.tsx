import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getActivityDetail, MockOrientation } from '@/lib/strava';
import ActivityViewClient from './ActivityViewClient';
import DownloadButton from '@/app/components/DownloadButton';

interface ActivityPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photos?: string; orientation?: string }>;
}

export default async function ActivityPage({ params, searchParams }: ActivityPageProps) {
  const { id } = await params;
  const { photos, orientation } = await searchParams;

  let activity;
  if (id === 'mock') {
    const mockOptions = {
      photos: photos ? parseInt(photos, 10) : undefined,
      orientation: (['landscape', 'portrait', 'mixed'].includes(orientation ?? '') ? orientation : undefined) as MockOrientation | undefined,
    };
    activity = await getActivityDetail('', id, mockOptions);
  } else {
    const session = await getSession();

    if (!session.accessToken) {
      redirect('/');
    }

    activity = await getActivityDetail(session.accessToken, id);
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">
        <div className="mb-3 flex items-center justify-between sm:mb-6">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
            >
              &larr; Back to activities
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-text-primary">
              {activity.name}
            </h1>
          </div>
          <DownloadButton activityId={id} />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <ActivityViewClient activity={activity} />
        </div>
      </div>
    </div>
  );
}
