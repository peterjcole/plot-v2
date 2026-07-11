import type { SessionData } from '@/lib/auth';

/**
 * Whether the logged-in athlete has access to premium (backend-powered)
 * features: personal heatmap tiles, explorer tiles, and photo import/serving.
 *
 * Backed by the athlete allowlist in plot-backend; the decision is resolved
 * once at login (see app/api/auth/callback/route.ts) and cached in the
 * session, so this check is zero-I/O.
 */
export function hasPremium(session: Pick<SessionData, 'entitlements'>): boolean {
  return !!session.entitlements?.premium;
}
