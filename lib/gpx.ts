import { Waypoint, RouteSegment } from './types';

function haversineKm(a: Waypoint, b: Waypoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Splits a GPX track into waypoints and pre-filled segments for import.
 * Waypoints are placed every ~spacingKm (default 2km), always including
 * start and end. Each segment receives the track coordinates between its
 * two waypoints so the route renders immediately without ORS routing.
 */
export function selectGpxWaypoints(
  points: Waypoint[],
  spacingKm = 2
): { waypoints: Waypoint[]; segments: RouteSegment[] } {
  if (points.length <= 1) {
    return { waypoints: points, segments: [] };
  }

  const cumDist: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineKm(points[i - 1], points[i]));
  }
  const totalKm = cumDist[cumDist.length - 1];

  // Ensure at most 20 waypoints by widening spacing on long routes
  const effectiveSpacing = Math.max(spacingKm, totalKm / 20);

  const wpIndices: number[] = [0];
  let nextTarget = effectiveSpacing;
  for (let i = 1; i < points.length - 1; i++) {
    if (cumDist[i] >= nextTarget) {
      wpIndices.push(i);
      nextTarget += effectiveSpacing;
    }
  }
  wpIndices.push(points.length - 1);

  const waypoints = wpIndices.map((i) => points[i]);
  const segments: RouteSegment[] = wpIndices.slice(0, -1).map((startIdx, si) => ({
    snapped: true,
    coordinates: points.slice(startIdx, wpIndices[si + 1] + 1),
  }));

  return { waypoints, segments };
}

export function parseGpx(content: string): Waypoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'application/xml');

  let points = Array.from(doc.querySelectorAll('trkpt'));
  if (points.length === 0) {
    points = Array.from(doc.querySelectorAll('wpt'));
  }

  return points.flatMap((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') ?? '');
    const lon = parseFloat(pt.getAttribute('lon') ?? '');
    if (isNaN(lat) || isNaN(lon)) return [];
    const eleText = pt.querySelector('ele')?.textContent;
    const ele = eleText != null ? parseFloat(eleText) : undefined;
    return [{ lat, lng: lon, ...(ele != null && !isNaN(ele) ? { ele } : {}) }];
  });
}

export function simplifyWaypoints(waypoints: Waypoint[], maxPoints = 100): Waypoint[] {
  if (waypoints.length <= maxPoints) return waypoints;
  const result: Waypoint[] = [];
  const last = waypoints.length - 1;
  for (let i = 0; i <= last; i++) {
    if (i === 0 || i === last || Math.round((i * (maxPoints - 1)) / last) !== Math.round(((i - 1) * (maxPoints - 1)) / last)) {
      result.push(waypoints[i]);
    }
  }
  return result;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildTrackPoints(
  waypoints: Waypoint[],
  segments?: RouteSegment[]
): Waypoint[] {
  if (waypoints.length === 0) return [];
  if (!segments || segments.length === 0) return waypoints;

  const points: Waypoint[] = [waypoints[0]];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.coordinates.length >= 2) {
      // Use routed coordinates (skip first point as it duplicates previous endpoint)
      for (let j = 1; j < seg.coordinates.length; j++) {
        points.push(seg.coordinates[j]);
      }
    } else {
      // Straight line — just add the endpoint waypoint
      points.push(waypoints[i + 1]);
    }
  }

  return points;
}

export function generateGpx(
  waypoints: Waypoint[],
  segments?: RouteSegment[],
  name = 'Route'
): string {
  const trackPoints = buildTrackPoints(waypoints, segments);

  const trkpts = trackPoints
    .map((wp) => {
      const ele = wp.ele != null ? `\n        <ele>${wp.ele}</ele>` : '';
      return `      <trkpt lat="${wp.lat}" lon="${wp.lng}">${ele}\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="plotv2"
  xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGpx(
  waypoints: Waypoint[],
  segments?: RouteSegment[],
  name = 'route'
) {
  const gpx = generateGpx(waypoints, segments, name);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
