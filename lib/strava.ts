import { SessionData } from './auth';
import { ActivityData, ActivitySummary } from './types';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

/** Refreshes the token in-place if near expiry. Returns true if a refresh occurred. */
export async function refreshTokenIfNeeded(session: SessionData): Promise<boolean> {
  if (!session.expiresAt || !session.refreshToken) {
    return false;
  }

  // Refresh if within 5 minutes of expiry
  if (session.expiresAt > Date.now() / 1000 + 300) {
    return false;
  }

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID ?? '',
      client_secret: process.env.STRAVA_CLIENT_SECRET ?? '',
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  session.accessToken = data.access_token;
  session.refreshToken = data.refresh_token;
  session.expiresAt = data.expires_at;

  return true;
}

export async function getAthleteActivities(
  accessToken: string,
  page = 1,
  perPage = 20,
): Promise<ActivitySummary[]> {
  const res = await fetch(
    `${STRAVA_API_BASE}/athlete/activities?page=${page}&per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    throw new Error(`Strava API error: ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activities: any[] = await res.json();

  return activities.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    startDate: a.start_date,
    distance: a.distance,
    movingTime: a.moving_time,
    elevationGain: a.total_elevation_gain,
  }));
}

export type MockOrientation = 'landscape' | 'portrait' | 'mixed';

function getMockActivity(photoCount: number, orientation: MockOrientation): ActivityData {
  // A loop route around the Lake District
  const route: [number, number][] = [
    [54.4500, -3.0000],
    [54.4550, -2.9900],
    [54.4600, -2.9750],
    [54.4650, -2.9600],
    [54.4700, -2.9500],
    [54.4720, -2.9350],
    [54.4700, -2.9200],
    [54.4650, -2.9100],
    [54.4580, -2.9050],
    [54.4500, -2.9100],
    [54.4420, -2.9150],
    [54.4380, -2.9300],
    [54.4400, -2.9500],
    [54.4430, -2.9700],
    [54.4470, -2.9850],
    [54.4500, -3.0000],
  ];

  const mixedSizes = ['600/400', '400/600', '600/400', '500/500', '400/600', '600/400', '600/400', '400/600', '500/500', '600/400'];

  function getPhotoSize(index: number): string {
    switch (orientation) {
      case 'landscape': return '600/400';
      case 'portrait': return '400/600';
      case 'mixed': return mixedSizes[index % mixedSizes.length];
    }
  }

  // Distribute photos evenly along the route
  const photos = Array.from({ length: photoCount }, (_, i) => {
    const routeIndex = Math.round((i / Math.max(photoCount - 1, 1)) * (route.length - 1));
    const pos = route[routeIndex];
    return {
      id: `mock-photo-${i + 1}`,
      url: `https://picsum.photos/seed/hike${i * 7 + 3}/${getPhotoSize(i)}`,
      lat: pos[0],
      lng: pos[1],
      caption: `Photo ${i + 1}`,
    };
  });

  return {
    id: 'mock',
    name: `Lake District Loop (${photoCount} photo${photoCount !== 1 ? 's' : ''}, ${orientation})`,
    route,
    photos,
    stats: {
      distance: 18500,
      movingTime: 7200,
      elevationGain: 850,
      averageSpeed: 2.57,
      maxSpeed: 4.1,
      startDate: '2025-06-15T09:00:00Z',
    },
  };
}

export async function getActivityDetail(
  accessToken: string,
  activityId: string,
  mockOptions?: { photos?: number; orientation?: MockOrientation },
): Promise<ActivityData> {
  if (activityId === 'mock') {
    const photoCount = mockOptions?.photos ?? 3;
    const orientation = mockOptions?.orientation ?? 'mixed';
    return getMockActivity(photoCount, orientation);
  }

  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Strava API error: ${res.status}`);
  }

  const activity = await res.json();

  const route = activity.map?.polyline
    ? decodePolyline(activity.map.polyline)
    : activity.map?.summary_polyline
      ? decodePolyline(activity.map.summary_polyline)
      : [];

  // Get photos if available
  const photosRes = await fetch(
    `${STRAVA_API_BASE}/activities/${activityId}/photos?size=600&photo_sources=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const photosData = photosRes.ok ? await photosRes.json() : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photos = (Array.isArray(photosData) ? photosData : []).map((p: any) => ({
    id: String(p.unique_id || p.id),
    url: p.urls?.['600'] || p.urls?.['100'] || '',
    lat: p.location?.[0] ?? route[0]?.[0] ?? 0,
    lng: p.location?.[1] ?? route[0]?.[1] ?? 0,
    caption: p.caption || undefined,
  }));

  return {
    id: String(activity.id),
    name: activity.name,
    route,
    photos,
    stats: {
      distance: activity.distance,
      movingTime: activity.moving_time,
      elevationGain: activity.total_elevation_gain,
      averageSpeed: activity.average_speed,
      maxSpeed: activity.max_speed,
      startDate: activity.start_date,
    },
  };
}

/** Decode a Google encoded polyline string into [lat, lng] pairs */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
