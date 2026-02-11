'use client';

import { useReducer } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';

export interface RouteState {
  waypoints: Waypoint[];
  segments: RouteSegment[];
}

export type RouteAction =
  | { type: 'ADD_WAYPOINT'; waypoint: Waypoint; snap?: boolean }
  | { type: 'INSERT_WAYPOINT'; index: number; waypoint: Waypoint; snap?: boolean }
  | { type: 'MOVE_WAYPOINT'; index: number; waypoint: Waypoint }
  | { type: 'REMOVE_WAYPOINT'; index: number }
  | { type: 'CLEAR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD'; waypoints: Waypoint[]; segments?: RouteSegment[] }
  | { type: 'UPDATE_SEGMENT'; index: number; coordinates: Waypoint[]; distance?: number }
  | { type: 'TOGGLE_SEGMENT_SNAP'; index: number };

interface HistoryState {
  past: RouteState[];
  present: RouteState;
  future: RouteState[];
}

function applyAction(state: RouteState, action: RouteAction): RouteState | null {
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
    default:
      return null;
  }
}

function historyReducer(state: HistoryState, action: RouteAction): HistoryState {
  switch (action.type) {
    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    case 'LOAD': {
      return {
        past: [],
        present: {
          waypoints: action.waypoints,
          segments: action.segments ?? [],
        },
        future: [],
      };
    }
    case 'UPDATE_SEGMENT': {
      // UPDATE_SEGMENT should NOT create undo history — it's an async side-effect
      const newPresent = applyAction(state.present, action);
      if (!newPresent) return state;
      return { ...state, present: newPresent };
    }
    default: {
      const newPresent = applyAction(state.present, action);
      if (!newPresent) return state;
      return {
        past: [...state.past, state.present],
        present: newPresent,
        future: [],
      };
    }
  }
}

const initialState: HistoryState = {
  past: [],
  present: { waypoints: [], segments: [] },
  future: [],
};

export function useRouteHistory() {
  const [state, dispatch] = useReducer(historyReducer, initialState);

  return {
    waypoints: state.present.waypoints,
    segments: state.present.segments,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dispatch,
  };
}
