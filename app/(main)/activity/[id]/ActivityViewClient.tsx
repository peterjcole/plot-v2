'use client';

import dynamic from 'next/dynamic';
import { ActivityData } from '@/lib/types';

const ActivityMap = dynamic(() => import('@/app/components/ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[630px] items-center justify-center bg-zinc-100 dark:bg-zinc-900">
      <p className="text-zinc-500">Loading map...</p>
    </div>
  ),
});

interface ActivityViewClientProps {
  activity: ActivityData;
}

export default function ActivityViewClient({ activity }: ActivityViewClientProps) {
  return <ActivityMap activity={activity} width={1200} height={630} />;
}
