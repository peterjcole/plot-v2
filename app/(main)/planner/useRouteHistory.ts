'use client';

import { useReducer } from 'react';
import { Waypoint } from '@/lib/types';

export interface RouteState {
  waypoints: Waypoint[];
}

export type RouteAction =
  | { type: 'ADD_WAYPOINT'; waypoint: Waypoint }
  | { type: 'INSERT_WAYPOINT'; index: number; waypoint: Waypoint }
  | { type: 'MOVE_WAYPOINT'; index: number; waypoint: Waypoint }
  | { type: 'REMOVE_WAYPOINT'; index: number }
  | { type: 'CLEAR' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD'; waypoints: Waypoint[] };

interface HistoryState {
  past: RouteState[];
  present: RouteState;
  future: RouteState[];
}

function applyAction(state: RouteState, action: RouteAction): RouteState | null {
  switch (action.type) {
    case 'ADD_WAYPOINT':
      return { waypoints: [...state.waypoints, action.waypoint] };
    case 'INSERT_WAYPOINT':
      return {
        waypoints: [
          ...state.waypoints.slice(0, action.index),
          action.waypoint,
          ...state.waypoints.slice(action.index),
        ],
      };
    case 'MOVE_WAYPOINT':
      return {
        waypoints: state.waypoints.map((wp, i) =>
          i === action.index ? action.waypoint : wp
        ),
      };
    case 'REMOVE_WAYPOINT':
      return {
        waypoints: state.waypoints.filter((_, i) => i !== action.index),
      };
    case 'CLEAR':
      if (state.waypoints.length === 0) return null;
      return { waypoints: [] };
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
        present: { waypoints: action.waypoints },
        future: [],
      };
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
  present: { waypoints: [] },
  future: [],
};

export function useRouteHistory() {
  const [state, dispatch] = useReducer(historyReducer, initialState);

  return {
    waypoints: state.present.waypoints,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dispatch,
  };
}
