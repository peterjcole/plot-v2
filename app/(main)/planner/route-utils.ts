import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { fromLonLat, toLonLat } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import { getLength, getDistance } from 'ol/sphere';
import { Waypoint, RouteSegment } from '@/lib/types';
import { type RotateStart, buildLoop } from '@/lib/route-rotate';
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

// ── Rotate route: loop geometry ──────────────────────────────────────────────

/** First and last waypoints this close (metres) count as an already-closed loop. */
const CLOSED_LOOP_TOLERANCE = 25;
/** A rotate start this close (metres along the loop) to a waypoint snaps onto it. */
const WAYPOINT_SNAP_TOLERANCE = 5;

function geoDistance(a: Waypoint, b: Waypoint): number {
  return getDistance([a.lng, a.lat], [b.lng, b.lat]);
}

export function isClosedLoop(waypoints: Waypoint[]): boolean {
  return waypoints.length >= 3 && geoDistance(waypoints[0], waypoints[waypoints.length - 1]) < CLOSED_LOOP_TOLERANCE;
}

interface LoopVertex {
  xy: number[];
  lngLat: Waypoint;
  segmentIndex: number;
  /** Index into the segment's routed coordinates (0 for an unrouted, straight segment). */
  coordIndex: number;
  /** Geodesic distance along the loop from its start, in metres. */
  cumDist: number;
}

export interface LoopPath {
  vertices: LoopVertex[];
  length: number;
  /** Loop waypoints — segment i runs waypoints[i] → waypoints[(i + 1) % length]. */
  waypoints: Waypoint[];
  /** Distance along the loop at which each segment's geometry starts and ends. */
  segmentBounds: { start: number; end: number }[];
}

/**
 * Flattens the route-as-a-loop (see lib/route-rotate.ts `buildLoop`) into one polyline,
 * tagging each vertex with where it sits in the loop so a distance along it can be turned
 * back into a ROTATE start. The closing segment is always straight here — if it'll be
 * snapped, its routed geometry doesn't exist yet.
 */
export function buildLoopPath(waypoints: Waypoint[], segments: RouteSegment[], closed: boolean): LoopPath {
  const loop = buildLoop({ waypoints, segments }, closed, false);
  const m = loop.waypoints.length;
  const vertices: LoopVertex[] = [];
  const segmentBounds: LoopPath['segmentBounds'] = [];
  let cumDist = 0;
  loop.segments.forEach((seg, j) => {
    const routed = seg.coordinates.length >= 2;
    const coords = routed ? seg.coordinates : [loop.waypoints[j], loop.waypoints[(j + 1) % m]];
    coords.forEach((c, i) => {
      const prev = vertices[vertices.length - 1];
      if (prev) cumDist += geoDistance(prev.lngLat, c);
      if (i === 0) segmentBounds.push({ start: cumDist, end: cumDist });
      vertices.push({
        xy: fromLonLat([c.lng, c.lat], OS_PROJECTION.code),
        lngLat: { lat: c.lat, lng: c.lng },
        segmentIndex: j,
        coordIndex: routed ? Math.min(i, coords.length - 2) : 0,
        cumDist,
      });
    });
    segmentBounds[j].end = cumDist;
  });
  return { vertices, length: cumDist, waypoints: loop.waypoints, segmentBounds };
}

/** Converts a distance along the loop into a ROTATE start plus the map point it sits at. */
export function positionAtDistance(path: LoopPath, d: number): { start: RotateStart; point: Waypoint } {
  const { vertices, waypoints, segmentBounds } = path;
  const m = waypoints.length;
  const dist = Math.max(0, Math.min(path.length, d));
  const atWaypoint = (wi: number) => ({ start: { waypointIndex: wi }, point: waypoints[wi] });

  // Edge [a, b] containing dist (the last edge when dist === length)
  let i = 1;
  while (i < vertices.length - 1 && vertices[i].cumDist < dist) i++;
  const a = vertices[i - 1];
  const b = vertices[i];
  const j = a.segmentIndex;

  // An edge spanning two segments is the gap between one segment's routed geometry and the
  // next's — the waypoint between them is the only sensible start there.
  if (b.segmentIndex !== j) return atWaypoint((j + 1) % m);
  // Close to either end of the segment: snap to that waypoint rather than splitting the
  // segment and adding a near-duplicate one.
  const fromStart = dist - segmentBounds[j].start;
  const toEnd = segmentBounds[j].end - dist;
  if (fromStart <= WAYPOINT_SNAP_TOLERANCE && fromStart <= toEnd) return atWaypoint(j);
  if (toEnd <= WAYPOINT_SNAP_TOLERANCE) return atWaypoint((j + 1) % m);

  const span = b.cumDist - a.cumDist;
  const t = span > 0 ? (dist - a.cumDist) / span : 0;
  const [lng, lat] = toLonLat([a.xy[0] + (b.xy[0] - a.xy[0]) * t, a.xy[1] + (b.xy[1] - a.xy[1]) * t], OS_PROJECTION.code);
  const point = { lat, lng };
  return { start: { segmentIndex: j, coordIndex: a.coordIndex, point }, point };
}

/** Distance along the loop of the point on it nearest to `p`. */
export function projectOntoPath(path: LoopPath, p: Waypoint): number {
  const [px, py] = fromLonLat([p.lng, p.lat], OS_PROJECTION.code);
  let best = 0;
  let bestSq = Infinity;
  for (let i = 1; i < path.vertices.length; i++) {
    const a = path.vertices[i - 1];
    const b = path.vertices[i];
    const dx = b.xy[0] - a.xy[0];
    const dy = b.xy[1] - a.xy[1];
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - a.xy[0]) * dx + (py - a.xy[1]) * dy) / lenSq)) : 0;
    const ex = a.xy[0] + dx * t - px;
    const ey = a.xy[1] + dy * t - py;
    const sq = ex * ex + ey * ey;
    if (sq < bestSq) {
      bestSq = sq;
      best = a.cumDist + (b.cumDist - a.cumDist) * t;
    }
  }
  return best;
}
