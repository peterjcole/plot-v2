import { backendFetch } from './auth';
import { ActivityData, ActivitySummary } from './types';

export async function getAthleteActivities(
  jwt: string,
  page = 1,
  perPage = 20,
): Promise<ActivitySummary[]> {
  const res = await backendFetch(
    `/activities?page=${page}&perPage=${perPage}`,
    jwt,
  );

  if (!res.ok) {
    throw new Error(`Backend API error: ${res.status}`);
  }

  return res.json();
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
  jwt: string,
  activityId: string,
  mockOptions?: { photos?: number; orientation?: MockOrientation },
): Promise<ActivityData> {
  if (activityId === 'mock') {
    const photoCount = mockOptions?.photos ?? 3;
    const orientation = mockOptions?.orientation ?? 'mixed';
    return getMockActivity(photoCount, orientation);
  }

  const res = await backendFetch(`/activities/${activityId}`, jwt);

  if (!res.ok) {
    throw new Error(`Backend API error: ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activity: any = await res.json();

  const route = activity.map?.polyline
    ? decodePolyline(activity.map.polyline)
    : activity.map?.summary_polyline
      ? decodePolyline(activity.map.summary_polyline)
      : [];

  // Photos are included in the backend response as _photos
  const photos = (activity._photos ?? []).map((p: { id: string; url: string; lat: number | null; lng: number | null; caption?: string }) => ({
    id: p.id,
    url: p.url,
    lat: p.lat ?? route[0]?.[0] ?? 0,
    lng: p.lng ?? route[0]?.[1] ?? 0,
    caption: p.caption,
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
