'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';
import { isAwaitingRoute } from '@/lib/route-actions';
import { RouteAction } from './useRouteHistory';

const legKey = (from: Waypoint, to: Waypoint) => `${from.lat},${from.lng}|${to.lat},${to.lng}`;

/** Indices of segments still waiting to be routed, keyed by the two points each joins. */
function awaitingLegs(waypoints: Waypoint[], segments: RouteSegment[]): Map<string, number[]> {
  const legs = new Map<string, number[]>();
  segments.forEach((seg, i) => {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    if (!from || !to || !isAwaitingRoute(seg)) return;
    const key = legKey(from, to);
    const indices = legs.get(key);
    if (indices) indices.push(i);
    else legs.set(key, [i]);
  });
  return legs;
}

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
  // In-flight requests keyed by the two points they route between, not by segment index —
  // inserts, removes, reverses and rotates shift indices without changing what needs fetching.
  const inFlightRef = useRef<Map<string, AbortController>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest committed route and dispatch, read when a fetch resolves. Results are matched to
  // segments by endpoints at that point, so they never land on a segment that has since
  // changed. Synced in a layout effect so they're current as of the last commit; actions
  // dispatched but not yet rendered are still invisible, so this narrows that race rather
  // than closing it.
  const routeRef = useRef({ waypoints, segments });
  const dispatchRef = useRef(dispatch);
  useLayoutEffect(() => {
    routeRef.current = { waypoints, segments };
    dispatchRef.current = dispatch;
  }, [waypoints, segments, dispatch]);

  const legs = useMemo(() => awaitingLegs(waypoints, segments), [waypoints, segments]);

  useEffect(() => {
    // Drop requests for legs no segment is waiting on any more (undone, edited, routed).
    // Everything else keeps running, even if its segment's index has moved.
    for (const [key, controller] of inFlightRef.current) {
      if (!legs.has(key)) {
        controller.abort();
        inFlightRef.current.delete(key);
      }
    }

    if (legs.size === 0) return;

    // Debounce to batch rapid changes
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      for (const [key, [firstIdx]] of legs) {
        if (inFlightRef.current.has(key)) continue;
        const from = waypoints[firstIdx];
        const to = waypoints[firstIdx + 1];

        const controller = new AbortController();
        inFlightRef.current.set(key, controller);

        // Apply to whichever segments join these points and are still waiting *now*
        const apply = (coordinates: Waypoint[], distance: number | undefined) => {
          const { waypoints: wps, segments: segs } = routeRef.current;
          for (const index of awaitingLegs(wps, segs).get(key) ?? []) {
            dispatchRef.current({ type: 'UPDATE_SEGMENT', index, coordinates, distance });
          }
        };

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
              apply(data.coordinates, data.distance);
            } else {
              // No route found — fall back to straight line (leave unrouted)
              apply([from, to], undefined);
            }
          })
          .catch((err) => {
            if (err.name === 'AbortError') return;
            // Routing failed — fall back to straight line
            apply([from, to], undefined);
          })
          .finally(() => {
            // Only if it's still ours — a newer request for this leg may have replaced it
            if (inFlightRef.current.get(key) === controller) inFlightRef.current.delete(key);
          });
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [legs, waypoints]);

  // Cleanup on unmount. Clear the map too, so a remount on the same instance (Fast Refresh)
  // refetches instead of skipping legs whose aborted requests are still listed.
  useEffect(() => {
    const inFlight = inFlightRef.current;
    return () => {
      for (const controller of inFlight.values()) {
        controller.abort();
      }
      inFlight.clear();
    };
  }, []);

  // Every awaiting leg has a request queued or in flight, and every request ends by
  // patching its segments (routed or straight-line fallback) — so this is exactly "routing".
  // Counted from `legs`, not segments, so a segment with no endpoints can't stick it on.
  return { isRouting: legs.size > 0 };
}
