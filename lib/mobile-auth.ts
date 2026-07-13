import { jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export interface MobileBackendConfig {
  url: string;
  token: string;
  athleteId: string;
}

/**
 * Resolves backend config for a mobile-app request, authenticated by the
 * plot-backend-issued JWT (Strava login → Bearer token, see docs/DESIGN.md
 * §4 "Mobile endpoint auth"). Returns null on any auth or config failure;
 * callers should respond 401 without distinguishing the cause.
 */
export async function getMobileBackendConfig(request: NextRequest): Promise<MobileBackendConfig | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const jwtSecret = process.env.JWT_SECRET;
  const url = process.env.TILES_BACKEND_URL;
  const token = process.env.TILES_BEARER_TOKEN;
  if (!jwtSecret || !url || !token) return null;

  try {
    const { payload } = await jwtVerify(authHeader.slice(7), new TextEncoder().encode(jwtSecret));
    if (typeof payload.athlete_id !== 'number') return null;
    return { url, token, athleteId: String(payload.athlete_id) };
  } catch {
    return null;
  }
}
