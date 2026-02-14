import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getActivityDetail, MockOrientation } from '@/lib/strava';
import Header from '@/app/components/Header';
import DownloadButton from '@/app/components/DownloadButton';
import ActivityViewClient from './ActivityViewClient';

interface ActivityPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ photos?: string; orientation?: string }>;
}

export async function generateMetadata({ params }: ActivityPageProps): Promise<Metadata> {
  const { id } = await params;

  if (id === 'mock') {
    return { title: 'Mock Activity – Plot' };
  }

  const session = await getSession();
  if (!session.accessToken) {
    return { title: 'Activity – Plot' };
  }

  try {
    const activity = await getActivityDetail(session.accessToken, id);
    return { title: `${activity.name} – Plot` };
  } catch {
    return { title: 'Activity – Plot' };
  }
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
        <div className="mb-3 sm:mb-6">
          <Header logo="sm">
            <DownloadButton activityId={id} />
          </Header>
          <h1 className="mt-3 text-xl font-semibold text-text-primary">
            {activity.name}
          </h1>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <ActivityViewClient activity={activity} />
        </div>
      </div>
    </div>
  );
}
