import { Waypoint, RouteSegment } from './types';

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
  savedAt: string;
}

type StoredRoute = StoredRouteV2;

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

export function saveRoute(
  waypoints: Waypoint[],
  segments: RouteSegment[],
  mapCenter: [number, number],
  mapZoom: number
): void {
  try {
    const data: StoredRouteV2 = {
      version: 2,
      waypoints: waypoints.map(({ lat, lng, ele }) => ({
        lat,
        lng,
        ...(ele != null ? { ele } : {}),
      })),
      segments,
      mapCenter,
      mapZoom,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadRoute(): StoredRoute | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version === 1) return migrateV1(data as StoredRouteV1);
    if (data?.version === 2) return data as StoredRouteV2;
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
