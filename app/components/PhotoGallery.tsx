'use client';

import { useEffect, useRef } from 'react';
import { ActivityPhoto } from '@/lib/types';
import PhotoBadge from './PhotoBadge';

interface PhotoGalleryProps {
  photos: ActivityPhoto[];
  activeIndex?: number;
  columnCount?: number;
}

export default function PhotoGallery({ photos, activeIndex, columnCount = 2 }: PhotoGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (activeIndex === undefined || activeIndex < 0 || activeIndex >= photos.length) return;
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex, photos.length]);

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto"
      style={{ columns: columnCount, columnGap: 4 }}
    >
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          ref={(el) => { itemRefs.current[index] = el; }}
          className="relative break-inside-avoid"
          style={{ marginBottom: 4, display: 'inline-block', width: '100%', marginTop: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption || `Photo ${index + 1}`}
            className="block w-full"
          />
          <PhotoBadge number={index + 1} />
        </div>
      ))}
    </div>
  );
}
