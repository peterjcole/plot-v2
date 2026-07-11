import type { RouteContentAction } from './route-actions';
import type { RouteHistoryInit } from '@/app/(main)/planner/useRouteHistory';

/**
 * The one persisted shape for a route's editing state — action log + cursor (so undo/redo
 * survives reload without ever re-hitting the routing API) plus the map view the user was
 * looking at. Free-tier writes this to localStorage (lib/route-storage.ts); premium writes
 * the identical shape to the backend (lib/saved-routes.ts) — only the storage adapter
 * differs, not the format.
 */
export interface RoutePersistedData {
  actions: RouteContentAction[];
  cursor: number;
  mapCenter: [number, number];
  mapZoom: number;
  mapRotation?: number;
}

export function toHistoryInit(data: Pick<RoutePersistedData, 'actions' | 'cursor'>): RouteHistoryInit {
  return { actions: data.actions, cursor: data.cursor };
}
