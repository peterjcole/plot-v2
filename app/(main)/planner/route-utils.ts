import { fromLonLat } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import { getLength } from 'ol/sphere';
import { Waypoint } from '@/lib/types';
import { OS_PROJECTION } from '@/lib/map-config';

export function calculateDistance(waypoints: Waypoint[]): number {
  if (waypoints.length < 2) return 0;
  const coords = waypoints.map((wp) =>
    fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
  );
  const line = new LineString(coords);
  return getLength(line, { projection: OS_PROJECTION.code });
}
