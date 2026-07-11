import { Waypoint, RouteSegment } from './types';

export interface RouteState {
  waypoints: Waypoint[];
  segments: RouteSegment[];
}

export const EMPTY_ROUTE_STATE: RouteState = { waypoints: [], segments: [] };

// Content-changing actions — the only things ever appended to a route's persisted
// action log. UNDO/REDO/RESTORE (in useRouteHistory.ts) move the cursor over this
// log but are never themselves logged.
export type RouteContentAction =
  | { type: 'ADD_WAYPOINT'; waypoint: Waypoint; snap?: boolean }
  | { type: 'INSERT_WAYPOINT'; index: number; waypoint: Waypoint; snap?: boolean }
  | { type: 'MOVE_WAYPOINT'; index: number; waypoint: Waypoint }
  | { type: 'REMOVE_WAYPOINT'; index: number }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; waypoints: Waypoint[]; segments?: RouteSegment[] }
  | { type: 'UPDATE_SEGMENT'; index: number; coordinates: Waypoint[]; distance?: number }
  | { type: 'TOGGLE_SEGMENT_SNAP'; index: number }
  | { type: 'REVERSE' };

/**
 * Pure state transition for a single content action. Returns null when the action
 * doesn't apply to the given state (e.g. CLEAR on an already-empty route) — callers
 * treat null as "no-op, don't record this".
 */
export function applyAction(state: RouteState, action: RouteContentAction): RouteState | null {
  switch (action.type) {
    case 'ADD_WAYPOINT': {
      const newSegments = [...state.segments];
      if (state.waypoints.length > 0) {
        newSegments.push({
          snapped: action.snap ?? false,
          coordinates: [],
        });
      }
      return {
        waypoints: [...state.waypoints, action.waypoint],
        segments: newSegments,
      };
    }
    case 'INSERT_WAYPOINT': {
      const { index, waypoint } = action;
      const newWaypoints = [
        ...state.waypoints.slice(0, index),
        waypoint,
        ...state.waypoints.slice(index),
      ];

      const newSegments = [...state.segments];
      if (state.waypoints.length < 2) {
        // Was 0 or 1 waypoint, inserting makes it 2 — add a segment
        if (newWaypoints.length >= 2) {
          newSegments.push({
            snapped: action.snap ?? false,
            coordinates: [],
          });
        }
      } else {
        // Split the segment at (index - 1) into two
        const segIdx = Math.max(0, index - 1);
        const original = newSegments[segIdx];
        const inheritSnap = action.snap ?? original?.snapped ?? false;
        newSegments.splice(segIdx, 1,
          { snapped: inheritSnap, coordinates: [] },
          { snapped: inheritSnap, coordinates: [] },
        );
      }

      return { waypoints: newWaypoints, segments: newSegments };
    }
    case 'MOVE_WAYPOINT': {
      const newWaypoints = state.waypoints.map((wp, i) =>
        i === action.index ? action.waypoint : wp
      );
      const newSegments = state.segments.map((seg, i) => {
        // Clear coordinates of adjacent segments (before and after moved waypoint)
        if (i === action.index - 1 || i === action.index) {
          return { ...seg, coordinates: [], distance: undefined };
        }
        return seg;
      });
      return { waypoints: newWaypoints, segments: newSegments };
    }
    case 'REMOVE_WAYPOINT': {
      const { index } = action;
      const newWaypoints = state.waypoints.filter((_, i) => i !== index);
      const newSegments = [...state.segments];

      if (state.waypoints.length <= 2) {
        // Removing takes us to 0 or 1 waypoint — no segments
        return { waypoints: newWaypoints, segments: [] };
      }

      if (index === 0) {
        // Remove first segment
        newSegments.splice(0, 1);
      } else if (index === state.waypoints.length - 1) {
        // Remove last segment
        newSegments.splice(newSegments.length - 1, 1);
      } else {
        // Merge segments[index-1] and segments[index] into one
        const before = newSegments[index - 1];
        const after = newSegments[index];
        const merged: RouteSegment = {
          snapped: before.snapped || after.snapped,
          coordinates: [],
        };
        newSegments.splice(index - 1, 2, merged);
      }

      return { waypoints: newWaypoints, segments: newSegments };
    }
    case 'CLEAR':
      if (state.waypoints.length === 0) return null;
      return { waypoints: [], segments: [] };
    case 'LOAD':
      return {
        waypoints: action.waypoints,
        segments: action.segments ?? [],
      };
    case 'UPDATE_SEGMENT': {
      if (action.index < 0 || action.index >= state.segments.length) return null;
      const newSegments = state.segments.map((seg, i) => {
        if (i === action.index) {
          return {
            ...seg,
            coordinates: action.coordinates,
            distance: action.distance,
          };
        }
        return seg;
      });
      return { waypoints: state.waypoints, segments: newSegments };
    }
    case 'TOGGLE_SEGMENT_SNAP': {
      if (action.index < 0 || action.index >= state.segments.length) return null;
      const newSegments = state.segments.map((seg, i) => {
        if (i === action.index) {
          return {
            snapped: !seg.snapped,
            coordinates: [],
            distance: undefined,
          };
        }
        return seg;
      });
      return { waypoints: state.waypoints, segments: newSegments };
    }
    case 'REVERSE': {
      if (state.waypoints.length < 2) return null;
      const waypoints = [...state.waypoints].reverse();
      const segments = [...state.segments].reverse().map(seg => ({
        ...seg,
        coordinates: [...seg.coordinates].reverse(),
      }));
      return { waypoints, segments };
    }
    default:
      return null;
  }
}

/**
 * Replays the full action log, returning the route state after each prefix —
 * result[i] = state after actions[0, i). Called once per hydration (LOAD/RESTORE);
 * useRouteHistory then indexes into this array for O(1) undo/redo instead of
 * re-walking the log on every cursor move.
 */
export function replayAll(actions: RouteContentAction[]): RouteState[] {
  const states: RouteState[] = [EMPTY_ROUTE_STATE];
  let state = EMPTY_ROUTE_STATE;
  for (const action of actions) {
    const next = applyAction(state, action);
    if (next) state = next;
    states.push(state);
  }
  return states;
}

/** One-off, uncached replay to a given cursor — for callers outside the live
 * history hook (e.g. duplicating a route that isn't the currently-open one). */
export function replayToCursor(actions: RouteContentAction[], cursor: number): RouteState {
  let state = EMPTY_ROUTE_STATE;
  for (let i = 0; i < cursor; i++) {
    const next = applyAction(state, actions[i]);
    if (next) state = next;
  }
  return state;
}
