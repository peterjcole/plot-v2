'use client';

import { useCallback, useReducer } from 'react';
import {
  type RouteState,
  type RouteContentAction,
  applyAction,
  replayAll,
  EMPTY_ROUTE_STATE,
} from '@/lib/route-actions';

export type { RouteState, RouteContentAction } from '@/lib/route-actions';

export type RouteAction =
  | RouteContentAction
  | { type: 'UNDO' }
  | { type: 'REDO' };

type InternalAction =
  | RouteAction
  | { type: 'RESTORE'; actions: RouteContentAction[]; cursor: number };

interface HistoryState {
  actions: RouteContentAction[];
  cursor: number; // present = presentByCursor[cursor]
  // presentByCursor[i] = route state after actions[0, i) — computed incrementally as
  // actions are appended (or fully, once, on RESTORE/LOAD) so undo/redo is an O(1)
  // array lookup instead of a replay. Never persisted — rebuilt from `actions` on hydration.
  presentByCursor: RouteState[];
}

export interface RouteHistoryInit {
  actions: RouteContentAction[];
  cursor: number;
}

function initHistoryState(init?: RouteHistoryInit): HistoryState {
  const actions = init?.actions ?? [];
  const cursor = init?.cursor ?? 0;
  return { actions, cursor, presentByCursor: replayAll(actions) };
}

function historyReducer(state: HistoryState, action: InternalAction): HistoryState {
  switch (action.type) {
    case 'RESTORE':
      return { actions: action.actions, cursor: action.cursor, presentByCursor: replayAll(action.actions) };
    case 'UNDO': {
      if (state.cursor === 0) return state;
      let cursor = state.cursor - 1;
      // An UPDATE_SEGMENT is an async side-effect of the action right before it (routing
      // fetch resolving) — skip back over any trailing run of them so one Undo press
      // removes the whole user gesture, not just its routed-coordinate patch.
      while (cursor > 0 && state.actions[cursor].type === 'UPDATE_SEGMENT') cursor -= 1;
      return { ...state, cursor };
    }
    case 'REDO': {
      if (state.cursor >= state.actions.length) return state;
      let cursor = state.cursor + 1;
      while (cursor < state.actions.length && state.actions[cursor].type === 'UPDATE_SEGMENT') cursor += 1;
      return { ...state, cursor };
    }
    case 'LOAD':
      // GPX import / "Open in Planner" / legacy-format migration — resets history to a
      // single seed action rather than appending, matching today's replace-in-place UX.
      return { actions: [action], cursor: 1, presentByCursor: replayAll([action]) };
    default: {
      // Any other content action (including UPDATE_SEGMENT): discard redo tail if the
      // user was mid-undo, append, and advance the cursor to the new tip.
      const actions = state.cursor < state.actions.length
        ? [...state.actions.slice(0, state.cursor), action]
        : [...state.actions, action];
      const basePresent = state.presentByCursor[state.cursor] ?? EMPTY_ROUTE_STATE;
      const nextPresent = applyAction(basePresent, action) ?? basePresent;
      const presentByCursor = [...state.presentByCursor.slice(0, state.cursor + 1), nextPresent];
      return { actions, cursor: actions.length, presentByCursor };
    }
  }
}

export function useRouteHistory(init?: RouteHistoryInit) {
  const [state, rawDispatch] = useReducer(historyReducer, init, initHistoryState);

  const present = state.presentByCursor[state.cursor] ?? EMPTY_ROUTE_STATE;

  const dispatch = useCallback((action: RouteAction) => {
    if (action.type === 'UNDO' || action.type === 'REDO' || action.type === 'LOAD') {
      rawDispatch(action);
      return;
    }
    // No-op guard, mirroring the old applyAction null-return convention — skip recording
    // history entries that wouldn't change anything (e.g. CLEAR on an empty route).
    if (!applyAction(present, action)) return;
    rawDispatch(action);
  }, [present]);

  // Used to hydrate a route asynchronously (premium: after GET /api/routes/:id resolves).
  // Synchronous hydration (localStorage) can instead pass `init` directly.
  const restore = useCallback((history: RouteHistoryInit) => {
    rawDispatch({ type: 'RESTORE', actions: history.actions, cursor: history.cursor });
  }, []);

  return {
    waypoints: present.waypoints,
    segments: present.segments,
    canUndo: state.cursor > 0,
    canRedo: state.cursor < state.actions.length,
    dispatch,
    restore,
    actions: state.actions,
    cursor: state.cursor,
  };
}
