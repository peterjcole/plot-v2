/**
 * Read-through / write-back cache for hillshade tiles, backed by the
 * plot-backend Worker's R2 gateway (`/hillshade-cache/*`). The Worker holds
 * the actual R2 binding (no S3 credentials, never expires); this module just
 * calls it over HTTP with the same server-to-server bearer token plotv2
 * already uses for other backend calls (see lib/backend.ts).
 *
 * Degrades to a no-op (both functions become cheap misses) if the backend
 * isn't configured, so local dev without those env vars still works —
 * callers always fall back to computing the tile themselves.
 */

const BASE = process.env.TILES_BACKEND_URL;
const TOKEN = process.env.TILES_BEARER_TOKEN;

export const HILLSHADE_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400, immutable';

interface KeyVariant {
  dark?: boolean;
  scale2?: boolean;
}

/**
 * Key scheme. The default (light, scale=1) variant MUST match the keys the
 * precompute/upload scripts already used for the GB set exactly —
 * `hillshade27700/{z}/{x}/{y}.png` — so those 133k precomputed tiles are hit
 * as-is. Other variants get their own subfolder so they never collide with
 * (or shadow) the precomputed set.
 */
export function hillshadeKey(prefix: string, z: number, x: number, y: number, variant: KeyVariant = {}): string {
  const parts: string[] = [];
  if (variant.scale2 && variant.dark) parts.push('2x-dark');
  else if (variant.scale2) parts.push('2x');
  else if (variant.dark) parts.push('dark');

  return parts.length > 0 ? `${prefix}/${parts[0]}/${z}/${x}/${y}.png` : `${prefix}/${z}/${x}/${y}.png`;
}

function gatewayUrl(key: string): string | null {
  if (!BASE || !TOKEN) return null;
  return `${BASE.replace(/\/$/, '')}/hillshade-cache/${key}`;
}

/** Returns the cached PNG bytes, or null on a miss, misconfiguration, or any error — never throws. */
export async function getCachedTile(key: string): Promise<Buffer | null> {
  const url = gatewayUrl(key);
  if (!url) return null;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.error(`hillshade-cache: GET ${key} failed`, e);
    return null;
  }
}

/** Persists a computed tile. Best-effort — logs and swallows any failure so it never breaks the response. */
export async function putCachedTile(key: string, body: Buffer): Promise<void> {
  const url = gatewayUrl(key);
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      console.error(`hillshade-cache: PUT ${key} failed with HTTP ${res.status}`);
    }
  } catch (e) {
    console.error(`hillshade-cache: PUT ${key} failed`, e);
  }
}
