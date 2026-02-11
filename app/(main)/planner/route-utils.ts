import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { fromLonLat } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import { getLength } from 'ol/sphere';
import { Waypoint, RouteSegment } from '@/lib/types';
import { OS_PROJECTION } from '@/lib/map-config';

// Ensure projection is registered before any coordinate transforms
proj4.defs(OS_PROJECTION.code, OS_PROJECTION.proj4);
register(proj4);

function lineDistance(points: Waypoint[]): number {
  if (points.length < 2) return 0;
  const coords = points.map((wp) =>
    fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
  );
  const line = new LineString(coords);
  return getLength(line, { projection: OS_PROJECTION.code });
}

export function calculateDistance(
  waypoints: Waypoint[],
  segments?: RouteSegment[]
): number {
  if (waypoints.length < 2) return 0;

  // If no segments provided, fall back to straight-line through waypoints
  if (!segments || segments.length === 0) {
    return lineDistance(waypoints);
  }

  let total = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.distance != null) {
      // Use cached distance from routing API
      total += seg.distance;
    } else if (seg.coordinates.length >= 2) {
      // Calculate from routed coordinates
      total += lineDistance(seg.coordinates);
    } else {
      // Straight line between waypoints
      total += lineDistance([waypoints[i], waypoints[i + 1]]);
    }
  }
  return total;
}
