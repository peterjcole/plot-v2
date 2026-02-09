'use client';

import { useState, useEffect } from 'react';
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

function getGalleryLayout(photoCount: number) {
  if (photoCount === 0) return null;

  if (photoCount <= 2) {
    return { columns: 1 as const, galleryRatio: 0.4 };
  }

  if (photoCount === 3) {
    return { columns: 1 as const, galleryRatio: 0.27 };
  }

  if (photoCount === 4) {
    return { columns: 1 as const, galleryRatio: 0.2 };
  }

  return { columns: 2 as const, galleryRatio: 0.38 };
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

  const layout = getGalleryLayout(activity.photos.length);

  if (!layout) {
    return <ActivityMap activity={activity} width={width} height={height} />;
  }

  const displayPhotos = activity.photos.slice(0, 8);
  const isSinglePhoto = displayPhotos.length === 1;
  const { columns, galleryRatio } = layout;
  const galleryWidth = Math.round(width * galleryRatio);

  const itemGap = 4;

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
          background: 'linear-gradient(to right, transparent 0%, rgba(255,248,236,0.15) 20%, rgba(255,248,236,0.3) 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '8px 16px 8px 8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            ...(columns === 1
              ? { flexDirection: 'column' as const }
              : { flexDirection: 'row' as const, flexWrap: 'wrap' as const, alignContent: 'center' as const }),
            justifyContent: 'center',
            gap: itemGap,
          }}
        >
          {displayPhotos.map((photo, index) => (
            <div
              key={photo.id}
              style={{
                padding: 4,
                background: 'rgba(255,248,236,0.6)',
                borderRadius: 4,
                ...(columns === 2 ? { width: `calc(50% - ${itemGap / 2}px)` } : {}),
              }}
            >
              <div
                style={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(44,44,36,0.18)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || `Photo ${index + 1}`}
                  style={{
                    display: 'block',
                    width: '100%',
                    ...(isSinglePhoto
                      ? {}
                      : { aspectRatio: '4 / 3', objectFit: 'cover' as const }),
                  }}
                />
              </div>
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'block',
                  marginTop: 2,
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#4A5A2B',
                  lineHeight: 1,
                }}
              >
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
