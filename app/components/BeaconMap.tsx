'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, Polyline, CircleMarker, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OS_DEFAULT_CENTER } from '@/lib/map-config';
import { getActivityColor } from '@/lib/activity-categories';
import { resolveOsBaseMap, OsTileLadder } from './map/OsTileLadder';
import { RouteOutlineFilter, StartEndMarkers, DirectionArrows } from './map/RouteDecorations';

// A sibling of ActivityMap, not a reimplementation of it: the walked trail
// gets ActivityMap's own route treatment (glow outline, direction chevrons,
// start/end markers), via the same shared components, coloured by activity
// type the same way every other route in the app is. What's genuinely
// different here — and the only reason this isn't just <ActivityMap/> — is
// that a beacon has *two* lines (an unwalked plan plus a live trail, not one
// finished route) and no ActivityData (no photos/description) to hand it.

interface BeaconMapProps {
  route: [number, number][];
  trail: [number, number][];
  current: [number, number] | null;
  ended: boolean;
  osDark: boolean;
  activity: string;
  cardPadding: [number, number, number, number]; // top, right, bottom, left — kept the map's live point clear of the status card
}

// Re-fits bounds to the fetched padding whenever the point *set* first
// becomes non-empty-ish — re-fitting on every 30s poll would yank the view
// out from under someone who's zoomed in to check progress near the front.
function FitOnData({ route, trail, current, cardPadding }: Omit<BeaconMapProps, 'ended' | 'osDark' | 'activity'>) {
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

export default function BeaconMap({ route, trail, current, ended, osDark, activity, cardPadding }: BeaconMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const anchor: [number, number] | undefined = current ?? route[0] ?? trail[0];
  const center: [number, number] = anchor ?? [OS_DEFAULT_CENTER.lat, OS_DEFAULT_CENTER.lng];
  const { crs, tileUrl, minZoom, maxZoom, isInGB } = resolveOsBaseMap(center, { osDark });

  const routeColor = getActivityColor(activity);
  const outlineColor = osDark ? 'rgba(7,14,20,0.65)' : 'rgba(7,14,20,0.82)';

  return (
    // Absolutely positioned to fill its parent rather than 100%/100% —
    // percentage heights only resolve against an ancestor with an explicit
    // height, and the page's flex layout doesn't reliably give it one
    // (this is what left the map blank before). `zIndex: 0` (not `auto`)
    // gives this wrapper its own stacking context, so Leaflet's internal
    // panes — several of which sit at z-index 400-700 — stack only against
    // each other, not against the status card floating over the map.
    <div ref={wrapperRef} style={{ position: 'absolute', inset: 0, zIndex: 0, colorScheme: 'only light' }}>
      <MapContainer
        center={center}
        zoom={7}
        minZoom={minZoom}
        maxZoom={maxZoom}
        crs={crs}
        style={{ position: 'absolute', inset: 0 }}
        zoomControl={false}
        attributionControl={false}
      >
        <OsTileLadder tileUrl={tileUrl} isInGB={isInGB} />

        {/* Planned route: the same dark-casing + dashed-orange "preview"
            treatment the planner uses for an unconfirmed route — it's a
            plan, not yet something that happened. */}
        {route.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: 'rgba(7,14,20,0.6)', weight: 7, opacity: 1 }} />
            <Polyline positions={route} pathOptions={{ color: 'rgba(224,112,32,0.75)', weight: 3, opacity: 1, dashArray: '2 9' }} />
          </>
        )}

        {/* Walked trail: ActivityMap's own route treatment, reused rather
            than a bespoke lighter version — glow outline, direction
            chevrons, and a start marker. The end marker (checkered flag)
            only appears once the workout has actually ended; while live,
            the current-position puck below stands in for it. */}
        {trail.length > 1 && (
          <>
            <Polyline positions={trail} pathOptions={{ color: routeColor, weight: 9, opacity: 0.68 }} />
            <RouteOutlineFilter strokeColor={routeColor} outlineColor={outlineColor} />
            <DirectionArrows route={trail} color={outlineColor} />
          </>
        )}
        {trail.length > 0 && <StartEndMarkers route={trail} color={routeColor} showEnd={ended} />}

        {current && !ended && (
          <CircleMarker center={current} radius={8} pathOptions={{ color: 'white', weight: 2, fillColor: routeColor, fillOpacity: 1 }} />
        )}

        <FitOnData route={route} trail={trail} current={current} cardPadding={cardPadding} />
        <ResizeHandler />
        <ZoomControl position="topright" />
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
