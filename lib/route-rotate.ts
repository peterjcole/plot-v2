import { Waypoint, RouteSegment } from './types';
import type { RouteState } from './route-actions';

// Pure loop/rotation logic behind the ROTATE action. Deliberately geometry-free (no `ol`)
// so the action log can be replayed server-side (app/api/mobile/routes/[id]) — anything
// needing distances (is the route already closed? where along it is the new start?) is
// decided by the UI and baked into the action payload.

export type RotateStart =
  | { waypointIndex: number }
  | { segmentIndex: number; coordIndex: number; point: Waypoint };

export interface RouteLoop {
  /** Loop waypoints — segment i runs waypoints[i] → waypoints[(i + 1) % length]. */
  waypoints: Waypoint[];
  segments: RouteSegment[];
}

/**
 * Treats the route as a loop. A `closed` route (end already back at the start) drops its
 * duplicate final waypoint; an open one gains a closing segment from end back to start.
 */
export function buildLoop(state: RouteState, closed: boolean, closeSnap: boolean): RouteLoop {
  if (closed) {
    // The final waypoint is merged into the first, so the last segment now ends at the
    // start waypoint — extend its routed geometry to meet it (the two were up to the
    // closed-loop tolerance apart) rather than leaving a gap.
    const waypoints = state.waypoints.slice(0, -1);
    // Don't lose the dropped finish waypoint's name/elevation if the start lacks them
    const finish = state.waypoints[state.waypoints.length - 1];
    // (field by field, so an explicit `undefined` behaves the same as after a JSON replay)
    const merged: Waypoint = { ...waypoints[0] };
    const name = merged.name ?? finish.name;
    const ele = merged.ele ?? finish.ele;
    delete merged.name;
    delete merged.ele;
    if (name != null) merged.name = name;
    if (ele != null) merged.ele = ele;
    waypoints[0] = merged;
    const segments = [...state.segments];
    const last = segments[segments.length - 1];
    if (last && last.coordinates.length >= 2) {
      segments[segments.length - 1] = { ...last, coordinates: [...last.coordinates, { lat: waypoints[0].lat, lng: waypoints[0].lng }], distance: undefined };
    }
    return { waypoints, segments };
  }
  return {
    waypoints: state.waypoints,
    segments: [...state.segments, { snapped: closeSnap, coordinates: [] }],
  };
}

function rotateAtWaypoint(loop: RouteLoop, k: number): RouteState {
  const { waypoints, segments } = loop;
  return {
    waypoints: [...waypoints.slice(k), ...waypoints.slice(0, k), waypoints[k]],
    segments: [...segments.slice(k), ...segments.slice(0, k)],
  };
}

/**
 * Re-orders the loop so it starts and finishes at `start`. A mid-segment start splits that
 * segment in two, keeping its routed coordinates either side of the split point so nothing
 * needs re-routing. Returns null if `start` doesn't index into the loop.
 */
export function rotateLoop(loop: RouteLoop, start: RotateStart): RouteState | null {
  const m = loop.waypoints.length;
  if (m < 1 || loop.segments.length !== m) return null;

  if ('waypointIndex' in start) {
    if (start.waypointIndex < 0 || start.waypointIndex >= m) return null;
    return rotateAtWaypoint(loop, start.waypointIndex);
  }

  const { segmentIndex: j, coordIndex: c, point } = start;
  const seg = loop.segments[j];
  if (!seg) return null;

  const routed = seg.coordinates.length >= 2;
  if (routed && (c < 0 || c >= seg.coordinates.length - 1)) return null;
  const first: RouteSegment = {
    snapped: seg.snapped,
    coordinates: routed ? [...seg.coordinates.slice(0, c + 1), point] : [],
  };
  const second: RouteSegment = {
    snapped: seg.snapped,
    coordinates: routed ? [point, ...seg.coordinates.slice(c + 1)] : [],
  };

  const split: RouteLoop = {
    waypoints: [...loop.waypoints.slice(0, j + 1), point, ...loop.waypoints.slice(j + 1)],
    segments: [...loop.segments.slice(0, j), first, second, ...loop.segments.slice(j + 1)],
  };
  return rotateAtWaypoint(split, j + 1);
}
