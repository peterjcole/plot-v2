'use client';

import { useEffect, useRef, useState } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';
import { RouteAction } from './useRouteHistory';

interface UseRouteSnappingOptions {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  dispatch: React.Dispatch<RouteAction>;
}

export function useRouteSnapping({
  waypoints,
  segments,
  dispatch,
}: UseRouteSnappingOptions) {
  const [isRouting, setIsRouting] = useState(false);
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Find segments that need routing: snapped=true, coordinates=[]
    const pending: number[] = [];
    segments.forEach((seg, i) => {
      if (seg.snapped && seg.coordinates.length === 0) {
        pending.push(i);
      }
    });

    if (pending.length === 0) return;

    // Debounce to batch rapid changes
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setIsRouting(true);
      let activeCount = 0;

      for (const segIdx of pending) {
        // Cancel any existing request for this segment
        const existing = abortControllersRef.current.get(segIdx);
        if (existing) existing.abort();

        const controller = new AbortController();
        abortControllersRef.current.set(segIdx, controller);

        const from = waypoints[segIdx];
        const to = waypoints[segIdx + 1];
        if (!from || !to) continue;

        activeCount++;

        fetch(
          `/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`,
          { signal: controller.signal }
        )
          .then((res) => {
            if (!res.ok) throw new Error('Route fetch failed');
            return res.json();
          })
          .then((data: { coordinates: Waypoint[]; distance: number }) => {
            if (data.coordinates.length > 0) {
              dispatch({
                type: 'UPDATE_SEGMENT',
                index: segIdx,
                coordinates: data.coordinates,
                distance: data.distance,
              });
            } else {
              // No route found — fall back to straight line (leave unrouted)
              dispatch({
                type: 'UPDATE_SEGMENT',
                index: segIdx,
                coordinates: [from, to],
                distance: undefined,
              });
            }
          })
          .catch((err) => {
            if (err.name === 'AbortError') return;
            // Routing failed — fall back to straight line
            dispatch({
              type: 'UPDATE_SEGMENT',
              index: segIdx,
              coordinates: [from, to],
              distance: undefined,
            });
          })
          .finally(() => {
            abortControllersRef.current.delete(segIdx);
            activeCount--;
            if (activeCount <= 0) setIsRouting(false);
          });
      }

      if (activeCount === 0) setIsRouting(false);
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [waypoints, segments, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
    };
  }, []);

  return { isRouting };
}
