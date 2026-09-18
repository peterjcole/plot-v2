'use client';

import { TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'proj4leaflet';
import {
  OS_PROJECTION, OS_TILE_URL, OS_DARK_TILE_URL, TOPO_TILE_URL, TOPO_DARK_TILE_URL, SATELLITE_TILE_URL,
} from '@/lib/map-config';

// Shared by every map in this app that draws on OS 1:25k tiles with a
// topo/EPSG:3857 fallback outside GB — ActivityMap and BeaconMap both
// delegate here rather than each re-deriving the same CRS, GB-bounds check
// and tile-ladder JSX (they used to; that duplication is what this file
// replaces).
export const GB_BOUNDS = { minLat: 49.8, maxLat: 61.5, minLng: -8.0, maxLng: 2.0 };

export function isPointInGB(lat: number, lng: number): boolean {
  return lat >= GB_BOUNDS.minLat && lat <= GB_BOUNDS.maxLat && lng >= GB_BOUNDS.minLng && lng <= GB_BOUNDS.maxLng;
}

// A module-level singleton, not one per consumer — Proj4Leaflet CRS objects
// are stateless and safe to share, and every map wants the identical
// EPSG:27700 setup anyway.
export const osCRS = new L.Proj.CRS(OS_PROJECTION.code, OS_PROJECTION.proj4, {
  resolutions: OS_PROJECTION.resolutions,
  origin: OS_PROJECTION.origin,
});

// Fix Leaflet's default marker icon paths (broken in bundlers) once, for
// any consumer that renders a plain L.Marker with the default icon.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface OsBaseMapConfig {
  crs: L.CRS;
  tileUrl: string;
  minZoom: number;
  maxZoom: number;
  isInGB: boolean;
}

/** Bounding-box check to decide CRS/tiles at render time. Errs toward
 * EPSG:27700 (OS tiles) for mainland GB; Irish/NI points fall through to
 * topo/EPSG:3857, same as satellite. */
export function resolveOsBaseMap(center: [number, number], opts: { satellite?: boolean; osDark?: boolean } = {}): OsBaseMapConfig {
  const { satellite = false, osDark = false } = opts;
  const isInGB = !satellite && isPointInGB(center[0], center[1]);
  return {
    crs: satellite || !isInGB ? L.CRS.EPSG3857 : osCRS,
    tileUrl: satellite
      ? SATELLITE_TILE_URL
      : isInGB
        ? osDark ? OS_DARK_TILE_URL : OS_TILE_URL
        : osDark ? TOPO_DARK_TILE_URL : TOPO_TILE_URL,
    minZoom: satellite || !isInGB ? 2 : 0,
    maxZoom: satellite || !isInGB ? 18 : 9,
    isInGB,
  };
}

/** The tile-layer ladder itself — a denser stack of `minZoom`/`maxNativeZoom`
 * ranges for GB's native z6-9 OS tiles, a plainer two-layer stack for the
 * z11-18 topo/satellite fallback. */
export function OsTileLadder({ tileUrl, isInGB }: { tileUrl: string; isInGB: boolean }) {
  return isInGB ? (
    <>
      <TileLayer url={tileUrl} minZoom={6} maxNativeZoom={9} minNativeZoom={8} />
      <TileLayer url={tileUrl} minZoom={4} maxZoom={5} minNativeZoom={6} maxNativeZoom={9} />
      <TileLayer url={tileUrl} minZoom={3} maxZoom={3} minNativeZoom={4} maxNativeZoom={9} />
      <TileLayer url={tileUrl} maxZoom={2} maxNativeZoom={9} />
    </>
  ) : (
    <>
      <TileLayer url={tileUrl} minZoom={12} minNativeZoom={14} maxNativeZoom={16} maxZoom={18} />
      <TileLayer url={tileUrl} maxZoom={11} maxNativeZoom={16} />
    </>
  );
}
