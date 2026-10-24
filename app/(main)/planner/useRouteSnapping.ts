'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';
import { isAwaitingRoute } from '@/lib/route-actions';
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
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCountRef = useRef(0);
  const [isRouting, setIsRouting] = useState(false);
  // Latest route, read when a fetch resolves — results are applied by segment index, so they
  // must be checked against what that index means *now* (see `stillPending`)
  // Synced in a layout effect — it runs during commit, before any fetch callback can, so it
  // never lags the committed route (a passive effect can flush after a fetch resolves).
  const routeRef = useRef({ waypoints, segments });
  useLayoutEffect(() => { routeRef.current = { waypoints, segments }; }, [waypoints, segments]);

  useEffect(() => {
    // Find segments that need routing: snapped=true, coordinates=[]
    const pending: number[] = [];
    segments.forEach((seg, i) => {
      if (isAwaitingRoute(seg)) {
        pending.push(i);
      }
    });

    if (pending.length === 0) return;

    // Debounce to batch rapid changes
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      let addedCount = 0;

      for (const segIdx of pending) {
        // Cancel any existing request for this segment
        const existing = abortControllersRef.current.get(segIdx);
        if (existing) existing.abort();

        const controller = new AbortController();
        abortControllersRef.current.set(segIdx, controller);

        const from = waypoints[segIdx];
        const to = waypoints[segIdx + 1];
        if (!from || !to) continue;

        // The route may have changed while the fetch was in flight (undo/redo, a rotate,
        // an insert...). Only apply the result if segment `segIdx` still joins the same two
        // points and is still waiting to be routed — otherwise it'd land on the wrong segment.
        const stillPending = () => {
          const { waypoints: wps, segments: segs } = routeRef.current;
          const a = wps[segIdx];
          const b = wps[segIdx + 1];
          const seg = segs[segIdx];
          return !!a && !!b && !!seg && isAwaitingRoute(seg)
            && a.lat === from.lat && a.lng === from.lng && b.lat === to.lat && b.lng === to.lng;
        };

        addedCount++;
        activeCountRef.current++;

        fetch(
          `/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`,
          { signal: controller.signal }
        )
          .then((res) => {
            if (!res.ok) throw new Error('Route fetch failed');
            return res.json();
          })
          .then((data: { coordinates: Waypoint[]; distance: number }) => {
            if (!stillPending()) return;
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
            if (err.name === 'AbortError' || !stillPending()) return;
            // Routing failed — fall back to straight line
            dispatch({
              type: 'UPDATE_SEGMENT',
              index: segIdx,
              coordinates: [from, to],
              distance: undefined,
            });
          })
          .finally(() => {
            // Only if it's still ours — a newer request for this segment may have replaced it
            if (abortControllersRef.current.get(segIdx) === controller) abortControllersRef.current.delete(segIdx);
            activeCountRef.current--;
            if (activeCountRef.current <= 0) {
              activeCountRef.current = 0;
              setIsRouting(false);
            }
          });
      }

      if (addedCount > 0) setIsRouting(true);
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
