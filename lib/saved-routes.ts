import type { Waypoint, RouteSegment } from './types';
import type { RouteContentAction } from './route-actions';

export interface RouteSummary {
  id: string;
  name: string;
  location: string | null;
  distanceM: number;
  waypointCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RouteDetail extends RouteSummary {
  actions: RouteContentAction[];
  cursor: number;
  mapCenter: [number, number];
  mapZoom: number;
  mapRotation?: number;
}

export const UNTITLED_ROUTE_NAME = 'Untitled route';

/**
 * What to actually display in place of a route's name: the real name if the user set
 * one, else its geocoded location (more useful than a bare "Untitled route" when you
 * have several), else the literal placeholder as a last resort. `kind` tells callers
 * which of those three it is, so they can style geocoded/placeholder labels as
 * visually distinct from a real custom name.
 */
export function displayRouteLabel(route: { name: string; location: string | null }): { label: string; kind: 'custom' | 'geocoded' | 'placeholder' } {
  if (route.name !== UNTITLED_ROUTE_NAME) return { label: route.name, kind: 'custom' };
  if (route.location) return { label: route.location, kind: 'geocoded' };
  return { label: UNTITLED_ROUTE_NAME, kind: 'placeholder' };
}

/**
 * Text styling for a route label by `displayRouteLabel` kind — custom names are full
 * brightness, geocoded (auto-derived) names are dimmer + italic so they read as "not
 * something you typed", and the bare placeholder is dimmest of all.
 */
export function routeLabelStyle(kind: 'custom' | 'geocoded' | 'placeholder'): { color: string; fontStyle: 'italic' | 'normal' } {
  if (kind === 'custom') return { color: 'var(--ice)', fontStyle: 'normal' };
  if (kind === 'geocoded') return { color: 'var(--fog)', fontStyle: 'italic' };
  return { color: 'var(--fog-dim)', fontStyle: 'normal' };
}

/**
 * Filesystem-safe slug for a GPX export filename, e.g. "Lake District Loop" → "lake-district-loop.gpx".
 * Falls back to "route" when there's no real name/location to derive one from (free tier,
 * or a still-untitled route with no geocoded location yet).
 */
export function routeExportName(route: { name: string; location: string | null }): string {
  const { label, kind } = displayRouteLabel(route);
  if (kind === 'placeholder') return 'route';
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'route';
}

export interface RouteUpdatePatch {
  name?: string;
  location?: string | null;
  distanceM: number;
  waypointCount: number;
  actions: RouteContentAction[];
  cursor: number;
  mapCenter: [number, number];
  mapZoom: number;
  mapRotation?: number;
}

async function parseOrNull<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function listRoutes(): Promise<RouteSummary[]> {
  const res = await fetch('/api/routes');
  const data = await parseOrNull<{ routes: RouteSummary[] }>(res);
  return data?.routes ?? [];
}

export async function createRoute(name = 'Untitled route'): Promise<RouteSummary | null> {
  const res = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return parseOrNull<RouteSummary>(res);
}

export async function getRoute(id: string): Promise<RouteDetail | null> {
  const res = await fetch(`/api/routes/${id}`);
  return parseOrNull<RouteDetail>(res);
}

export async function updateRoute(id: string, patch: RouteUpdatePatch): Promise<RouteSummary | null> {
  const res = await fetch(`/api/routes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseOrNull<RouteSummary>(res);
}

export async function duplicateRoute(
  id: string,
  name: string,
  waypoints: Waypoint[],
  segments: RouteSegment[],
): Promise<RouteSummary | null> {
  const res = await fetch(`/api/routes/${id}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, waypoints, segments }),
  });
  return parseOrNull<RouteSummary>(res);
}

export async function deleteRoute(id: string): Promise<boolean> {
  const res = await fetch(`/api/routes/${id}`, { method: 'DELETE' });
  return res.ok;
}
