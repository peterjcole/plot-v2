'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';
import { isAwaitingRoute } from '@/lib/route-actions';
import { RouteAction } from './useRouteHistory';

interface InFlight {
  controller: AbortController;
  from: Waypoint;
  to: Waypoint;
}

const samePoint = (a: Waypoint | undefined, b: Waypoint) => !!a && a.lat === b.lat && a.lng === b.lng;

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
  // In-flight request per segment index, with the endpoints it was fetched for
  const inFlightRef = useRef<Map<number, InFlight>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCountRef = useRef(0);
  const [isRouting, setIsRouting] = useState(false);
  // Latest committed route, read when a fetch resolves — results are applied by segment
  // index, so they must be checked against what that index means *now* (see `stillPending`).
  // Synced in a layout effect so it's current as of the last commit. It can't see actions
  // dispatched but not yet rendered, so `stillPending` narrows the wrong-segment race rather
  // than closing it.
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

    // Drop requests that no longer match the route: the segment is no longer awaiting
    // routing (undone, routed) or now joins different points. Matching ones keep running.
    for (const [segIdx, req] of inFlightRef.current) {
      if (!pending.includes(segIdx) || !samePoint(waypoints[segIdx], req.from) || !samePoint(waypoints[segIdx + 1], req.to)) {
        req.controller.abort();
        inFlightRef.current.delete(segIdx);
      }
    }

    if (pending.length === 0) return;

    // Debounce to batch rapid changes
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      let addedCount = 0;

      for (const segIdx of pending) {
        const from = waypoints[segIdx];
        const to = waypoints[segIdx + 1];
        if (!from || !to) continue;

        // Already fetching this exact segment — let it finish
        const existing = inFlightRef.current.get(segIdx);
        if (existing && samePoint(from, existing.from) && samePoint(to, existing.to)) continue;
        existing?.controller.abort();

        const controller = new AbortController();
        inFlightRef.current.set(segIdx, { controller, from, to });

        // The route may have changed while the fetch was in flight (undo/redo, a rotate,
        // an insert...). Only apply the result if segment `segIdx` still joins the same two
        // points and is still waiting to be routed — otherwise it'd land on the wrong segment.
        const stillPending = () => {
          const { waypoints: wps, segments: segs } = routeRef.current;
          const seg = segs[segIdx];
          return !!seg && isAwaitingRoute(seg) && samePoint(wps[segIdx], from) && samePoint(wps[segIdx + 1], to);
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
            if (inFlightRef.current.get(segIdx)?.controller === controller) inFlightRef.current.delete(segIdx);
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
    const inFlight = inFlightRef.current;
    return () => {
      for (const { controller } of inFlight.values()) {
        controller.abort();
      }
    };
  }, []);

  return { isRouting };
}
