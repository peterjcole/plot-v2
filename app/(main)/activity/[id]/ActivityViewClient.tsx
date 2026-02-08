'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ActivityData } from '@/lib/types';
import PhotoGallery from '@/app/components/PhotoGallery';

interface MapProps {
  activity: ActivityData;
  width: number;
  height: number;
  onPinClick?: (index: number) => void;
}

const ActivityMap = dynamic<MapProps>(() => import('@/app/components/ActivityMap'), {
  ssr: false,
});

interface ActivityViewClientProps {
  activity: ActivityData;
}

export default function ActivityViewClient({ activity }: ActivityViewClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [maxContainerHeight, setMaxContainerHeight] = useState<number | null>(null);
  const [mapHeight, setMapHeight] = useState<number | null>(null);
  const [isWide, setIsWide] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | undefined>(undefined);
  const [mapReady, setMapReady] = useState(false);

  const hasPhotos = activity.photos.length > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const containerWidth = Math.round(el.clientWidth);
      const wide = containerWidth >= 1024;
      setIsWide(wide);

      if (wide && hasPhotos) {
        const mw = Math.round(containerWidth * 0.6);
        // Calculate available height: viewport minus space above the container
        const containerTop = el.getBoundingClientRect().top;
        const availableHeight = Math.round(window.innerHeight - containerTop - 64);
        setMaxContainerHeight(Math.max(400, availableHeight));
        const viewportHeight = Math.max(500, window.innerHeight * 0.75);
        const mh = Math.round(Math.min(mw, viewportHeight));
        setDimensions({ width: mw, height: mh });
      } else {
        setMaxContainerHeight(null);
        const viewportHeight = hasPhotos
          ? Math.max(350, window.innerHeight * 0.7)
          : Math.max(500, window.innerHeight * 0.75);
        setDimensions({ width: containerWidth, height: Math.round(viewportHeight) });
      }
    };

    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [hasPhotos]);

  // In wide mode, observe the map wrapper's stretched height so the map fills it
  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el || !isWide) {
      setMapHeight(null);
      return;
    }

    const observer = new ResizeObserver(() => {
      setMapHeight(Math.round(el.clientHeight));
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [isWide]);

  // Poll for window.__MAP_READY__ set by TileLoadHandler inside ActivityMap
  useEffect(() => {
    if (mapReady || !dimensions) return;

    const interval = setInterval(() => {
      if (window.__MAP_READY__) {
        setMapReady(true);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [mapReady, dimensions]);

  // Reset ready state if activity changes
  useEffect(() => {
    window.__MAP_READY__ = false;
    setMapReady(false);
  }, [activity.id]);

  const handlePinClick = useCallback((index: number) => {
    setActivePhotoIndex(index);
  }, []);

  const spinner = (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-muted">
      <svg className="h-8 w-8 animate-spin text-text-tertiary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  if (!hasPhotos) {
    return (
      <div ref={containerRef} className="relative w-full">
        {dimensions && (
          <ActivityMap activity={activity} width={dimensions.width} height={dimensions.height} />
        )}
        {!mapReady && spinner}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full bg-surface-muted">
      {dimensions && (
        <div
          className={isWide ? 'flex flex-row items-stretch gap-1' : 'flex flex-col gap-1'}
          style={isWide && maxContainerHeight ? { maxHeight: maxContainerHeight } : undefined}
        >
          <div
            ref={mapWrapperRef}
            className={isWide ? 'shrink-0' : ''}
            style={isWide ? { width: dimensions.width, minHeight: dimensions.height } : undefined}
          >
            <ActivityMap
              activity={activity}
              width={dimensions.width}
              height={isWide && mapHeight ? mapHeight : dimensions.height}
              onPinClick={handlePinClick}
            />
          </div>
          <div className={isWide ? 'flex-1 overflow-y-auto' : 'flex-1'}>
            <PhotoGallery
              photos={activity.photos}
              activeIndex={activePhotoIndex}
              columnCount={isWide && activity.photos.length <= 3 ? 1 : !isWide && activity.photos.length === 1 ? 1 : 2}
            />
          </div>
        </div>
      )}
      {!mapReady && spinner}
    </div>
  );
}
