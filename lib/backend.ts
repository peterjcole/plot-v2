import type { ActivityData } from '@/lib/types';
import type { SessionData } from '@/lib/auth';
import { hasPremium } from '@/lib/entitlements';

export interface PremiumBackendConfig {
  url: string;
  token: string;
  athleteId: string;
}

/**
 * Resolves backend config for a premium-gated route (personal heatmap tiles,
 * explorer tiles, photos), or null if the athlete isn't entitled or the
 * backend isn't configured. Callers should respond 404 on null — intentionally
 * hiding the feature's existence from non-premium athletes, matching the
 * existing routes' behavior.
 */
export function getPremiumBackendConfig(session: Pick<SessionData, 'athlete' | 'entitlements'>): PremiumBackendConfig | null {
  const url = process.env.TILES_BACKEND_URL;
  const token = process.env.TILES_BEARER_TOKEN;
  if (!url || !token || !session.athlete || !hasPremium(session)) {
    return null;
  }
  return { url, token, athleteId: String(session.athlete.id) };
}

interface RecentActivityResponse {
  id: number;
  name: string;
  type: string | null;
  sportType: string | null;
  startDate: string;
  distance: number | null;
  movingTime: number | null;
  elevationGain: number | null;
  route: [number, number][]; // [lng, lat][] — GeoJSON order from backend
}

function getBackendConfig() {
  const url = process.env.TILES_BACKEND_URL;
  const token = process.env.TILES_BEARER_TOKEN;
  const athleteId = process.env.TILES_ATHLETE_ID;
  if (!url || !token || !athleteId) {
    throw new Error('Missing TILES_BACKEND_URL, TILES_BEARER_TOKEN, or TILES_ATHLETE_ID');
  }
  return { url, token, athleteId };
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number; firstname: string; lastname: string };
}

/**
 * Onboards an athlete into the backend (upsert + import-if-empty) and returns
 * whether they're on the premium feature allowlist. Called once at login
 * (see app/api/auth/callback/route.ts); the result is cached in the session
 * so later requests don't need to call the backend again. Best-effort — if
 * the backend is unreachable, the athlete is treated as non-premium and the
 * base app is unaffected.
 */
export async function bootstrapPremiumAccess(data: StravaTokenResponse): Promise<boolean> {
  const url = process.env.TILES_BACKEND_URL;
  const token = process.env.TILES_BEARER_TOKEN;
  if (!url || !token) return false;

  try {
    const res = await fetch(`${url}/users/bootstrap`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        athlete_id: data.athlete.id,
        first_name: data.athlete.firstname,
        last_name: data.athlete.lastname,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      }),
    });
    if (!res.ok) return false;

    const body: { allowed: boolean } = await res.json();
    return !!body.allowed;
  } catch {
    return false;
  }
}

export async function getRecentActivityFromBackend(minDistanceMeters: number): Promise<ActivityData> {
  const { url, token, athleteId } = getBackendConfig();

  const res = await fetch(`${url}/activities/recent?minDistance=${minDistanceMeters}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Athlete-Id': athleteId,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Backend /activities/recent failed (${res.status}): ${text}`);
  }

  const data: RecentActivityResponse = await res.json();

  return {
    id: String(data.id),
    name: data.name,
    type: data.type ?? data.sportType ?? undefined,
    description: undefined,
    // Backend returns [lng, lat]; ActivityData.route is [lat, lng]
    route: data.route.map(([lng, lat]) => [lat, lng] as [number, number]),
    photos: [],
    stats: {
      distance: data.distance ?? 0,
      movingTime: data.movingTime ?? 0,
      elevationGain: data.elevationGain ?? 0,
      averageSpeed: 0,
      maxSpeed: 0,
      startDate: data.startDate,
    },
  };
}

