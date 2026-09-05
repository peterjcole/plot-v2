import { type BaseMap } from '@/lib/map-config';

// GB bounding box with ~10km coastal leeway (see lib/gb-tile-check.ts for
// the precise per-tile check this approximates at bbox granularity).
const GB_BOUNDS = { minLat: 49.8, maxLat: 61.5, minLng: -8.0, maxLng: 2.0 };

export interface RouteFraming {
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  center: [number, number];
  isGB: boolean;
  /** true when the route needs EPSG:3857 topo tiles instead of OS EPSG:27700 (non-GB, non-satellite) */
  useTopo: boolean;
}

/**
 * Computes the route's bounding box, center, and which tile source it needs.
 * Shared by /api/wallpaper and /api/planner-printout (previously duplicated
 * verbatim in both routes).
 */
export function computeRouteFraming(route: [number, number][], baseMap: BaseMap): RouteFraming {
  const lats = route.map(([lat]) => lat);
  const lngs = route.map(([, lng]) => lng);
  const bbox = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
  const center: [number, number] = [
    (bbox.minLat + bbox.maxLat) / 2,
    (bbox.minLng + bbox.maxLng) / 2,
  ];

  const isSatellite = baseMap === 'satellite';
  const isGB = isSatellite || (
    center[0] >= GB_BOUNDS.minLat && center[0] <= GB_BOUNDS.maxLat &&
    center[1] >= GB_BOUNDS.minLng && center[1] <= GB_BOUNDS.maxLng
  );
  const useTopo = baseMap === 'os' && !isGB;

  return { bbox, center, isGB, useTopo };
}
