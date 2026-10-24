'use client';

import { useCallback, useMemo, useState } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';
import { applyAction, type RouteContentAction } from '@/lib/route-actions';
import type { RotateStart } from '@/lib/route-rotate';
import { RouteAction } from './useRouteHistory';
import { buildLoopPath, isClosedLoop, positionAtDistance, projectOntoPath } from './route-utils';

interface UseRouteRotateOptions {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  dispatch: React.Dispatch<RouteAction>;
  snapEnabled: boolean;
  isRouting: boolean;
  /** False outside planner mode — any open session is discarded rather than resurfacing
   * when the user comes back. */
  enabled: boolean;
  /** Called after a rotation is committed — the route has a new start point. */
  onApplied?: () => void;
}

interface RotateSession {
  // The committed route the session was started against. Any other committed change
  // (undo, import, a late routing patch) ends the session, so the draft can never refer
  // to stale segment indices.
  waypoints: Waypoint[];
  segments: RouteSegment[];
  draftDist: number;
  closeSnap: boolean;
}

/**
 * Rotate-route mode: a live preview of the route re-started somewhere else along its loop.
 * Nothing touches history until `apply()`, which records a single ROTATE action — so one
 * Undo reverts the whole rotation (plus the closing leg's routing patch, which the history
 * reducer skips over).
 */
export function useRouteRotate({ waypoints, segments, dispatch, snapEnabled, isRouting, enabled, onApplied }: UseRouteRotateOptions) {
  const [session, setSession] = useState<RotateSession | null>(null);
  // Any committed change underneath the session (route switched/loaded, undo, a routing
  // patch) or leaving planner mode ends it outright. Adjusting state during render (not in
  // an effect) — React re-renders immediately.
  const stale = !!session && (!enabled || session.waypoints !== waypoints || session.segments !== segments);
  if (stale) setSession(null);
  const active = !!session && !stale;

  const closed = useMemo(() => isClosedLoop(waypoints), [waypoints]);
  const closeSnap = session?.closeSnap ?? snapEnabled;
  const path = useMemo(
    () => (active ? buildLoopPath(waypoints, segments, closed, closeSnap) : null),
    [active, waypoints, segments, closed, closeSnap],
  );

  const position = useMemo(
    () => (path && session ? positionAtDistance(path, session.draftDist) : null),
    [path, session],
  );

  // Keyed on the resolved start rather than the raw distance, so dragging within a span
  // that resolves to the same start (e.g. snapped to a waypoint) doesn't rebuild the
  // preview and with it every planner feature on the map.
  const startKey = position ? JSON.stringify(position.start) : null;
  const draft = useMemo(() => {
    if (!startKey) return null;
    const start = JSON.parse(startKey) as RotateStart;
    const action: RouteContentAction = { type: 'ROTATE', closed, closeSnap, start };
    return { action, start, preview: applyAction({ waypoints, segments }, action) };
  }, [startKey, closed, closeSnap, waypoints, segments]);

  // Also wait out snapped segments still queued for routing (useRouteSnapping debounces
  // before isRouting flips) — their patch landing would end the session.
  const canStart = waypoints.length >= 2 && !isRouting
    && !segments.some((s) => s.snapped && s.coordinates.length === 0);

  const start = useCallback(() => {
    if (!canStart) return;
    setSession({ waypoints, segments, draftDist: 0, closeSnap: snapEnabled });
  }, [canStart, waypoints, segments, snapEnabled]);

  const cancel = useCallback(() => setSession(null), []);

  const setDraftDist = useCallback((draftDist: number) => {
    setSession((s) => (s ? { ...s, draftDist } : s));
  }, []);

  const toggleCloseSnap = useCallback(() => {
    setSession((s) => (s ? { ...s, closeSnap: !s.closeSnap } : s));
  }, []);

  const dragTo = useCallback((p: Waypoint) => {
    if (path) setDraftDist(projectOntoPath(path, p));
  }, [path, setDraftDist]);

  // Starting a session can't overlap routing (canStart), and any routing patch ends it, so
  // routing needn't be re-checked here. The start must actually have moved: on an open
  // route a no-move ROTATE would still add the closing leg, which is easy to do by accident
  // (Enter on the auto-focused slider).
  const moved = !!draft && !('waypointIndex' in draft.start && draft.start.waypointIndex === 0);
  const canApply = !!draft?.preview && moved;

  const apply = useCallback(() => {
    if (!draft?.preview || !canApply) return;
    dispatch(draft.action);
    setSession(null);
    onApplied?.();
  }, [draft, canApply, dispatch, onApplied]);

  return {
    active,
    canStart,
    /** Route to render while rotating — the rotated preview, or the route itself at a no-op position. */
    previewState: active ? (draft?.preview ?? null) : null,
    handlePoint: position?.point ?? null,
    draftDist: session?.draftDist ?? 0,
    loopLength: path?.length ?? 0,
    closed,
    closeSnap,
    canApply,
    start,
    cancel,
    apply,
    setDraftDist,
    toggleCloseSnap,
    dragTo,
  };
}
