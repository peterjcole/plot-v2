'use client';

import { useCallback, useMemo, useState } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';
import { applyAction, type RouteContentAction } from '@/lib/route-actions';
import { RouteAction } from './useRouteHistory';
import { buildLoopPath, isClosedLoop, positionAtDistance, projectOntoPath } from './route-utils';

interface UseRouteRotateOptions {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  dispatch: React.Dispatch<RouteAction>;
  snapEnabled: boolean;
  isRouting: boolean;
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
export function useRouteRotate({ waypoints, segments, dispatch, snapEnabled, isRouting, onApplied }: UseRouteRotateOptions) {
  const [session, setSession] = useState<RotateSession | null>(null);
  const active = !!session && session.waypoints === waypoints && session.segments === segments;

  const closed = useMemo(() => isClosedLoop(waypoints), [waypoints]);
  const path = useMemo(
    () => (active ? buildLoopPath(waypoints, segments, closed) : null),
    [active, waypoints, segments, closed],
  );

  const draft = useMemo(() => {
    if (!active || !path || !session) return null;
    const { start, point } = positionAtDistance(path, session.draftDist);
    const action: RouteContentAction = { type: 'ROTATE', closed, closeSnap: session.closeSnap, start };
    return { action, point, preview: applyAction({ waypoints, segments }, action) };
  }, [active, path, session, closed, waypoints, segments]);

  const start = useCallback(() => {
    if (waypoints.length < 2) return;
    setSession({ waypoints, segments, draftDist: 0, closeSnap: snapEnabled });
  }, [waypoints, segments, snapEnabled]);

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

  const canApply = !!draft?.preview && !isRouting;

  const apply = useCallback(() => {
    if (!draft?.preview || isRouting) return;
    dispatch(draft.action);
    setSession(null);
    onApplied?.();
  }, [draft, isRouting, dispatch, onApplied]);

  return {
    active,
    /** Route to render while rotating — the rotated preview, or the route itself at a no-op position. */
    previewState: active ? (draft?.preview ?? { waypoints, segments }) : null,
    handlePoint: draft?.point ?? null,
    draftDist: session?.draftDist ?? 0,
    loopLength: path?.length ?? 0,
    closed,
    closeSnap: session?.closeSnap ?? snapEnabled,
    canApply,
    start,
    cancel,
    apply,
    setDraftDist,
    toggleCloseSnap,
    dragTo,
  };
}
