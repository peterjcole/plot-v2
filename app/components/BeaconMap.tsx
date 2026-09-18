'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'proj4leaflet';
import {
  OS_PROJECTION, OS_DEFAULT_CENTER, OS_TILE_URL, OS_DARK_TILE_URL, TOPO_TILE_URL, TOPO_DARK_TILE_URL,
} from '@/lib/map-config';

// A deliberately lighter sibling of app/components/ActivityMap.tsx, not a
// reuse of it — ActivityMap is built around a finished `ActivityData`
// (photos, description overlay, activity-type colouring) that a live,
// possibly-still-running beacon doesn't have. What's shared is the thing
// that actually matters for correctness: the same EPSG:27700 CRS/tile setup
// and the GB-bounds fallback, so a beacon route lands on the identical map
// both apps already agree on, in and out of Great Britain alike.
const osCRS = new L.Proj.CRS(OS_PROJECTION.code, OS_PROJECTION.proj4, {
  resolutions: OS_PROJECTION.resolutions,
  origin: OS_PROJECTION.origin,
});

const GB_BOUNDS = { minLat: 49.8, maxLat: 61.5, minLng: -8.0, maxLng: 2.0 };

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

interface BeaconMapProps {
  route: [number, number][];
  trail: [number, number][];
  current: [number, number] | null;
  ended: boolean;
  osDark: boolean;
  cardPadding: [number, number, number, number]; // top, right, bottom, left — kept the map's live point clear of the status card
}

// Re-fits bounds to the fetched padding whenever the point *set* first
// becomes non-empty-ish — re-fitting on every 30s poll would yank the view
// out from under someone who's zoomed in to check progress near the front.
function FitOnData({ route, trail, current, cardPadding }: Omit<BeaconMapProps, 'ended' | 'osDark'>) {
  const map = useMap();
  useEffect(() => {
    const points = [...route, ...trail, ...(current ? [current] : [])];
    if (points.length === 0) return;
    const [top, right, bottom, left] = cardPadding;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { paddingTopLeft: [left, top], paddingBottomRight: [right, bottom] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, route.length > 0, trail.length > 0]);
  return null;
}

// Leaflet sizes itself from its container's layout box at mount, and never
// again unless told to — a card resizing, a phone rotating, or the mobile
// URL bar collapsing/expanding all change that box without firing anything
// Leaflet listens for on its own.
function ResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export default function BeaconMap({ route, trail, current, ended, osDark, cardPadding }: BeaconMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const anchor: [number, number] | undefined = current ?? route[0] ?? trail[0];
  const isInGB = anchor
    ? anchor[0] >= GB_BOUNDS.minLat && anchor[0] <= GB_BOUNDS.maxLat && anchor[1] >= GB_BOUNDS.minLng && anchor[1] <= GB_BOUNDS.maxLng
    : true;
  const center: [number, number] = anchor ?? [OS_DEFAULT_CENTER.lat, OS_DEFAULT_CENTER.lng];

  const activeCRS = isInGB ? osCRS : L.CRS.EPSG3857;
  const tileUrl = isInGB ? (osDark ? OS_DARK_TILE_URL : OS_TILE_URL) : osDark ? TOPO_DARK_TILE_URL : TOPO_TILE_URL;
  const minZoom = isInGB ? 0 : 2;
  const maxZoom = isInGB ? 9 : 18;

  const routeCasing = osDark ? 'rgba(240,248,250,0.35)' : 'rgba(7,54,66,0.35)';
  const routeCore = osDark ? '#F0F8FA' : '#073642';
  const trailCasing = osDark ? 'rgba(7,14,20,0.65)' : 'rgba(7,54,66,0.55)';

  return (
    // Absolutely positioned to fill its parent rather than 100%/100% —
    // percentage heights only resolve against an ancestor with an explicit
    // height, and the page's flex layout doesn't reliably give it one
    // (this is what left the map blank before).
    // `zIndex: 0` (not `auto`) is deliberate: it gives this wrapper its own
    // stacking context, so Leaflet's internal panes — several of which sit
    // at z-index 400-700 — stack only against each other, not against the
    // status card floating over the map (the card only needs z-10 to clear
    // a wrapper with no stacking context of its own).
    <div ref={wrapperRef} style={{ position: 'absolute', inset: 0, zIndex: 0, colorScheme: 'only light' }}>
      <MapContainer
        center={center}
        zoom={7}
        minZoom={minZoom}
        maxZoom={maxZoom}
        crs={activeCRS}
        style={{ position: 'absolute', inset: 0 }}
        zoomControl={true}
        attributionControl={false}
      >
        {isInGB ? (
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
        )}
        {route.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: routeCasing, weight: 7, opacity: 1 }} />
            <Polyline positions={route} pathOptions={{ color: routeCore, weight: 3, opacity: 0.9, dashArray: '1 9' }} />
          </>
        )}
        {trail.length > 1 && (
          <>
            <Polyline positions={trail} pathOptions={{ color: trailCasing, weight: 8, opacity: 1 }} />
            <Polyline positions={trail} pathOptions={{ color: '#E07020', weight: 5, opacity: 0.9 }} />
          </>
        )}
        {trail.length > 0 && (
          <CircleMarker
            center={trail[0]}
            radius={5}
            pathOptions={{ color: 'white', weight: 2, fillColor: routeCore, fillOpacity: 1 }}
          />
        )}
        {current && (
          <CircleMarker
            center={current}
            radius={ended ? 6 : 8}
            pathOptions={{
              color: 'white',
              weight: 2,
              fillColor: ended ? routeCore : '#E07020',
              fillOpacity: 1,
            }}
          />
        )}
        <FitOnData route={route} trail={trail} current={current} cardPadding={cardPadding} />
        <ResizeHandler />
      </MapContainer>
      <div
        style={{
          position: 'absolute',
          right: 6,
          bottom: 4,
          fontSize: 9,
          fontFamily: 'var(--mono)',
          color: 'rgba(7,54,66,0.55)',
          background: 'rgba(238,232,213,0.7)',
          padding: '1px 5px',
          borderRadius: 3,
          pointerEvents: 'none',
        }}
      >
        Contains OS data © Crown copyright
      </div>
    </div>
  );
}
