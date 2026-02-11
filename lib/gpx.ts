import { Waypoint, RouteSegment } from './types';

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
