import { Waypoint } from './types';

const STORAGE_KEY = 'plotv2-planner-route';

interface StoredRoute {
  version: 1;
  waypoints: { lat: number; lng: number }[];
  mapCenter: [number, number];
  mapZoom: number;
  savedAt: string;
}

export function saveRoute(
  waypoints: Waypoint[],
  mapCenter: [number, number],
  mapZoom: number
): void {
  try {
    const data: StoredRoute = {
      version: 1,
      waypoints: waypoints.map(({ lat, lng }) => ({ lat, lng })),
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
    if (data?.version !== 1) return null;
    return data as StoredRoute;
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
