import { cache } from 'react';

export interface BeaconPing {
  seq: number;
  lat: number;
  lng: number;
  recordedAt: string;
  distanceM: number | null;
  distanceRemainingM: number | null;
  ascentRemainingM: number | null;
  elapsedS: number | null;
}

export interface BeaconPublicData {
  activity: string;
  routeName: string | null;
  routeReversed: boolean;
  routeDistanceM: number | null;
  hasGpx: boolean;
  startedAt: string;
  endedAt: string | null;
  lastPingAt: string | null;
  pings: BeaconPing[];
}

/**
 * Server-side fetch of the public beacon summary, straight from
 * plot-backend (no auth — see app/api/beacon/[token]/route.ts for why).
 * `cache()` (React's per-request memo, not HTTP caching — the fetch itself
 * is `no-store`) dedupes the identical call `generateMetadata` and the page
 * component both need for the same request.
 */
export const fetchBeaconPublic = cache(async (token: string): Promise<BeaconPublicData | null> => {
  const backendUrl = process.env.TILES_BACKEND_URL;
  if (!backendUrl) return null;
  try {
    const res = await fetch(`${backendUrl}/b/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as BeaconPublicData;
  } catch {
    return null;
  }
});
