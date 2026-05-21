import type { ActivityData } from '@/lib/types';

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

export async function getRecentActivityId(minDistanceMeters: number): Promise<string> {
  const { url, token, athleteId } = getBackendConfig();

  const res = await fetch(`${url}/activities/recent?minDistance=${minDistanceMeters}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Athlete-Id': athleteId,
    },
  });

  if (res.status === 404) return '';
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Backend /activities/recent failed (${res.status}): ${text}`);
  }

  const data: Pick<RecentActivityResponse, 'id'> = await res.json();
  return String(data.id);
}
