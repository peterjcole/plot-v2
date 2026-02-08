'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ActivityData } from '@/lib/types';
import PhotoBadge from '@/app/components/PhotoBadge';

const ActivityMap = dynamic(() => import('@/app/components/ActivityMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: '#FFF8EC',
    }}>
      Loading map...
    </div>
  ),
});

interface RenderClientProps {
  activity: ActivityData;
  width?: number;
  height?: number;
}

export default function RenderClient({ activity, width: fixedWidth, height: fixedHeight }: RenderClientProps) {
  const [viewportSize, setViewportSize] = useState({ w: fixedWidth ?? 0, h: fixedHeight ?? 0 });

  useEffect(() => {
    if (fixedWidth && fixedHeight) return;
    const update = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [fixedWidth, fixedHeight]);

  const width = fixedWidth ?? viewportSize.w;
  const height = fixedHeight ?? viewportSize.h;

  if (!width || !height) return null;
  const hasPhotos = activity.photos.length > 0;

  if (!hasPhotos) {
    return <ActivityMap activity={activity} width={width} height={height} />;
  }

  const columnCount = activity.photos.length <= 3 ? 1 : 2;
  const galleryRatio = columnCount === 1 ? 0.25 : 0.4;
  const galleryWidth = Math.round(width * galleryRatio);

  return (
    <div style={{ width, height, position: 'relative' }}>
      <ActivityMap
        activity={activity}
        width={width}
        height={height}
        paddingRight={galleryWidth}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: galleryWidth,
          height,
          zIndex: 1000,
          overflow: 'hidden',
          columns: columnCount,
          columnFill: 'auto' as const,
          columnGap: 8,
          padding: 8,
        }}
      >
        {activity.photos.map((photo, index) => (
          <div
            key={photo.id}
            style={{
              position: 'relative',
              breakInside: 'avoid',
              marginBottom: 8,
              borderRadius: 4,
              overflow: 'hidden',
              border: '2px solid #5C5C50',
              boxShadow: '0 2px 8px rgba(44,44,36,0.18)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption || `Photo ${index + 1}`}
              style={{ display: 'block', width: '100%' }}
            />
            <PhotoBadge number={index + 1} />
          </div>
        ))}
      </div>
    </div>
  );
}
