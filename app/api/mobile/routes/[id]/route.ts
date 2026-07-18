import { NextRequest, NextResponse } from 'next/server';
import { getMobileBackendConfig } from '@/lib/mobile-auth';
import { replayToCursor } from '@/lib/route-actions';
import { buildTrackPoints, generateGpx, simplifyWaypoints } from '@/lib/gpx';
import { routeExportName, type RouteDetail } from '@/lib/saved-routes';
import { sampleElevationsForCoords } from '@/lib/dem';
import { elevationGain, smoothElevation } from '@/lib/elevation';
import type { Waypoint } from '@/lib/types';

const MAX_TRACK_POINTS = 1000;

function boundingBox(points: Waypoint[]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let minLng = points[0].lng;
  let minLat = points[0].lat;
  let maxLng = points[0].lng;
  let maxLat = points[0].lat;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const backend = await getMobileBackendConfig(request);
  if (!backend) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let route: RouteDetail;
  try {
    const res = await fetch(`${backend.url}/routes/${id}`, {
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
      },
    });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    route = await res.json();
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  const { waypoints, segments } = replayToCursor(route.actions, route.cursor);
  const trackPoints = buildTrackPoints(waypoints, segments);

  if (request.nextUrl.searchParams.get('format') === 'gpx') {
    const gpx = generateGpx(waypoints, segments, route.name);
    return new NextResponse(gpx, {
      headers: {
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': `attachment; filename="${routeExportName(route)}.gpx"`,
      },
    });
  }

  // Routed segments carry no elevation (only manually-placed waypoints might) — sample the
  // DEM ourselves, same pipeline the desktop elevation profile uses (see lib/dem.ts,
  // lib/elevation.ts), so ascent reads consistently across web and mobile.
  const simplified = simplifyWaypoints(trackPoints, MAX_TRACK_POINTS);
  const elevations = await sampleElevationsForCoords(simplified);
  const sampled = simplified.map((wp, i) => ({ ...wp, ele: elevations[i] }));
  // Same smoothing window as the desktop elevation profile (useElevationProfile.ts),
  // so ascent reads consistently between web and mobile.
  const windowSize = Math.max(5, Math.round(sampled.length / 40));
  const waypointsWithEle = smoothElevation(sampled, windowSize);

  return NextResponse.json({
    id: route.id,
    name: route.name,
    location: route.location,
    distanceM: route.distanceM,
    ascentM: elevationGain(waypointsWithEle),
    waypointCount: route.waypointCount,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
    waypoints: waypointsWithEle,
    bbox: boundingBox(trackPoints),
  });
}

// Swipe-to-delete on iOS: proxies straight to the backend's ownership-checked
// DELETE (removes the R2 blob then the D1 row) — same shape as the web
// client's DELETE proxy (app/api/routes/[id]/route.ts), but authenticated via
// the mobile JWT rather than a browser session.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const backend = await getMobileBackendConfig(request);
  if (!backend) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(`${backend.url}/routes/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${backend.token}`,
        'X-Athlete-Id': backend.athleteId,
      },
    });
    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
