'use client';

import { useEffect, useRef } from 'react';
import { ActivityPhoto } from '@/lib/types';

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
          style={{ marginBottom: 4 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption || `Photo ${index + 1}`}
            className="block w-full"
          />
          <div
            className="absolute left-1 top-1 flex items-center justify-center rounded-full"
            style={{
              width: 22,
              height: 22,
              background: 'rgba(8, 3, 87, 0.75)',
              border: '2px solid white',
              fontSize: 11,
              fontWeight: 700,
              color: 'white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          >
            {index + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
