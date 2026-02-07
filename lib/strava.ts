import { SessionData } from './auth';
import { ActivityData, ActivitySummary } from './types';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

/** Refreshes the token in-place if near expiry. Returns true if a refresh occurred. */
export async function refreshTokenIfNeeded(session: SessionData): Promise<boolean> {
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

export async function getActivityDetail(
  accessToken: string,
  activityId: string,
): Promise<ActivityData> {
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
