'use client';

import { useRouter } from 'next/navigation';
import { Map } from 'lucide-react';
import { loadRoute, saveRoute } from '@/lib/route-storage';
import { selectGpxWaypoints } from '@/lib/gpx';
import type { Waypoint } from '@/lib/types';

interface EditInPlannerButtonProps {
  route: [number, number][];
}

export default function EditInPlannerButton({ route }: EditInPlannerButtonProps) {
  const router = useRouter();

  function handleClick() {
    const existing = loadRoute();
    if (existing && existing.waypoints.length > 0) {
      const ok = window.confirm('You have an existing route in the Planner. Replace it with this activity route?');
      if (!ok) return;
    }

    const points: Waypoint[] = route.map(([lat, lng]) => ({ lat, lng }));
    const { waypoints, segments } = selectGpxWaypoints(points);
    saveRoute(waypoints, segments, [0, 0], 9);
    router.push('/planner');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-md bg-accent hover:bg-accent-light px-4 py-2 text-sm font-medium text-white transition-colors"
    >
      <Map size={15} aria-hidden="true" />
      Edit in Planner
    </button>
  );
}
