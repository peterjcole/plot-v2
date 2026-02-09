import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { fromLonLat } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import { getLength } from 'ol/sphere';
import { Waypoint } from '@/lib/types';
import { OS_PROJECTION } from '@/lib/map-config';

// Ensure projection is registered before any coordinate transforms
proj4.defs(OS_PROJECTION.code, OS_PROJECTION.proj4);
register(proj4);

export function calculateDistance(waypoints: Waypoint[]): number {
  if (waypoints.length < 2) return 0;
  const coords = waypoints.map((wp) =>
    fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
  );
  const line = new LineString(coords);
  return getLength(line, { projection: OS_PROJECTION.code });
}
