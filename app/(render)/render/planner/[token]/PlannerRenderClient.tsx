'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { type BaseMap } from '@/lib/map-config';
import { type ExportMode } from '@/lib/render-dimensions';

const ActivityMap = dynamic(() => import('@/app/components/ActivityMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#FFF8EC',
      }}
    >
      Loading map...
    </div>
  ),
});

const EMPTY_STATS = {
  distance: 0,
  movingTime: 0,
  elevationGain: 0,
  averageSpeed: 0,
  maxSpeed: 0,
  startDate: '',
};

interface PlannerJob {
  route: [number, number][];
  center: [number, number];
  exportMode: ExportMode;
  baseMap: BaseMap;
  osDark: boolean;
}

interface PlannerRenderClientProps {
  job: PlannerJob;
  bboxCenter: [number, number];
  renderZoom: number;
}

export default function PlannerRenderClient({
  job,
  bboxCenter,
  renderZoom,
}: PlannerRenderClientProps) {
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () =>
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!viewportSize.w || !viewportSize.h) return null;

  const activity = {
    id: 'planner',
    name: 'Route',
    route: job.route,
    photos: [],
    stats: EMPTY_STATS,
  };

  return (
    <ActivityMap
      activity={activity}
      width={viewportSize.w}
      height={viewportSize.h}
      baseMap={job.baseMap}
      osDark={job.osDark}
      centerZoom={{ center: bboxCenter, zoom: renderZoom }}
    />
  );
}
