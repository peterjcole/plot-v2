'use client';

import dynamic from 'next/dynamic';
import { ActivityData } from '@/lib/types';
import PhotoGallery from '@/app/components/PhotoGallery';

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
  const hasPhotos = activity.photos.length > 0;

  if (!hasPhotos) {
    return <ActivityMap activity={activity} width={width} height={height} />;
  }

  const mapWidth = Math.round(width * 0.6);

  return (
    <div className="flex bg-zinc-100" style={{ width, height, gap: 4 }}>
      <div className="shrink-0" style={{ width: mapWidth, height }}>
        <ActivityMap activity={activity} width={mapWidth} height={height} />
      </div>
      <div className="flex-1 overflow-hidden">
        <PhotoGallery
          photos={activity.photos}
          columnCount={activity.photos.length <= 2 ? 1 : 2}
        />
      </div>
    </div>
  );
}
