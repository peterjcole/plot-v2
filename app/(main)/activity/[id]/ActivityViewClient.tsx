'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ActivityData } from '@/lib/types';

const ActivityMap = dynamic(() => import('@/app/components/ActivityMap'), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-video items-center justify-center bg-zinc-100 dark:bg-zinc-900">
      <p className="text-zinc-500">Loading map...</p>
    </div>
  ),
});

interface ActivityViewClientProps {
  activity: ActivityData;
}

export default function ActivityViewClient({ activity }: ActivityViewClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(Math.max(500, window.innerHeight * 0.75));
      setDimensions({ width: w, height: h });
    };

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {dimensions ? (
        <ActivityMap activity={activity} width={dimensions.width} height={dimensions.height} />
      ) : (
        <div className="flex h-[75vh] min-h-[500px] items-center justify-center bg-zinc-100 dark:bg-zinc-900">
          <p className="text-zinc-500">Loading map...</p>
        </div>
      )}
    </div>
  );
}
