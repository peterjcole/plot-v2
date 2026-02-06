'use client';

import dynamic from 'next/dynamic';
import { ActivityData } from '@/lib/types';

const ActivityMap = dynamic(() => import('@/app/components/ActivityMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: '#f0f0f0',
    }}>
      Loading map...
    </div>
  ),
});

interface RenderClientProps {
  activity: ActivityData;
  width: number;
  height: number;
}

export default function RenderClient({ activity, width, height }: RenderClientProps) {
  return <ActivityMap activity={activity} width={width} height={height} />;
}
