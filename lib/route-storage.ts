import { Waypoint, RouteSegment } from './types';
import type { RouteContentAction } from './route-actions';
import type { RoutePersistedData } from './route-persistence';

const STORAGE_KEY = 'plotv2-planner-route';

interface StoredRouteV1 {
  version: 1;
  waypoints: { lat: number; lng: number }[];
  mapCenter: [number, number];
  mapZoom: number;
  savedAt: string;
}

interface StoredRouteV2 {
  version: 2;
  waypoints: { lat: number; lng: number; ele?: number }[];
  segments: RouteSegment[];
  mapCenter: [number, number];
  mapZoom: number;
  mapRotation?: number;
  savedAt: string;
}

interface StoredRouteV3 extends RoutePersistedData {
  version: 3;
  savedAt: string;
}

type StoredRoute = StoredRouteV3;

function migrateV1(v1: StoredRouteV1): StoredRouteV2 {
  const segments: RouteSegment[] = [];
  for (let i = 0; i < Math.max(0, v1.waypoints.length - 1); i++) {
    segments.push({ snapped: false, coordinates: [] });
  }
  return {
    version: 2,
    waypoints: v1.waypoints,
    segments,
    mapCenter: v1.mapCenter,
    mapZoom: v1.mapZoom,
    savedAt: v1.savedAt,
  };
}

// Legacy flat {waypoints, segments} → single-action log. Undo history has never persisted
// for anyone before this change, so starting fresh here is not a regression.
function migrateV2(v2: StoredRouteV2): StoredRouteV3 {
  const loadAction: RouteContentAction = {
    type: 'LOAD',
    waypoints: v2.waypoints as Waypoint[],
    segments: v2.segments,
  };
  return {
    version: 3,
    actions: [loadAction],
    cursor: 1,
    mapCenter: v2.mapCenter,
    mapZoom: v2.mapZoom,
    ...(v2.mapRotation != null ? { mapRotation: v2.mapRotation } : {}),
    savedAt: v2.savedAt,
  };
}

export function saveRoute(data: RoutePersistedData): void {
  try {
    const stored: StoredRouteV3 = { version: 3, ...data, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadRoute(): StoredRoute | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version === 1) return migrateV2(migrateV1(data as StoredRouteV1));
    if (data?.version === 2) return migrateV2(data as StoredRouteV2);
    if (data?.version === 3) return data as StoredRouteV3;
    return null;
  } catch {
    return null;
  }
}

export function clearStoredRoute(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
