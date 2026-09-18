'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, Polyline, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OS_DEFAULT_CENTER } from '@/lib/map-config';
import { getActivityColor } from '@/lib/activity-categories';
import { resolveOsBaseMap, OsTileLadder } from './map/OsTileLadder';
import { RouteOutlineFilter, StartEndMarkers, DirectionArrows } from './map/RouteDecorations';

// A sibling of ActivityMap, not a reimplementation of it: the planned route
// gets ActivityMap's own route treatment (glow outline, direction chevrons,
// start/end markers), via the same shared components, coloured by activity
// type the same way every other route in the app is. What's genuinely
// different here — and the only reason this isn't just <ActivityMap/> — is
// that a beacon overlays a second, live thing on top of that route (a thin
// progress trail + a current-position marker) that a finished ActivityData
// has no concept of.
const PROGRESS_COLOR = '#4080C0'; // --blu — distinct from every activity-type route colour so it never blends into the route it's tracking progress along

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

// "You are here" — deliberately a different visual language from
// StartEndMarkers' route pins (a filled dot, not a teardrop): the
// GPS-ping-style pulse is the same motif the loading screen and the status
// card's live indicator already use, so this reads as "live" on sight.
function CurrentLocationMarker({ position, live }: { position: [number, number]; live: boolean }) {
  const map = useMap();
  useEffect(() => {
    // Mirrors loading.tsx's GPS-ping markup: the ring is `position:absolute`
    // with no inset values inside a `flex` parent, so its static position —
    // and therefore its center — is recomputed as the animation grows it,
    // rather than drifting from a fixed top/left corner.
    const icon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
          <div style="position:relative;z-index:2;width:20px;height:20px;border-radius:50%;background:${PROGRESS_COLOR};border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.55);"></div>
          ${live ? `<div class="animate-contour-ping" style="position:absolute;border-radius:50%;border:1.5px solid ${PROGRESS_COLOR};"></div>` : ''}
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker(position, { icon, interactive: false, zIndexOffset: 2000 });
    marker.addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, position, live]);
  return null;
}

// A real Leaflet control (not a plain absolutely-positioned button) so it
// stacks natively under the zoom control in the same corner — the
// `leaflet-bar`/`leaflet-control` classes are Leaflet's own, giving it the
// same white rounded box for free rather than a bespoke one.
function RecenterControl({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    const control = new L.Control({ position: 'topright' });
    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const button = L.DomUtil.create('a', '', container);
      button.href = '#';
      button.title = 'Jump to current location';
      button.setAttribute('aria-label', 'Jump to current location');
      // `.leaflet-bar a` is a 26x26 block with no built-in flex centering
      // for a non-text child (unlike its text-based default content) —
      // center the icon explicitly rather than eyeballing a margin.
      button.style.cssText = 'display:flex;align-items:center;justify-content:center;';
      button.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="7"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/>' +
        '<line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>';
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        if (targetRef.current) map.panTo(targetRef.current);
      });
      return container;
    };
    control.addTo(map);
    return () => {
      control.remove();
    };
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

        {/* Planned route: exactly ActivityMap's route treatment — this is
            just a route, rendered the same way any other route in the app
            is. */}
        {route.length > 1 && (
          <>
            <Polyline positions={route} pathOptions={{ color: routeColor, weight: 9, opacity: 0.68 }} />
            <RouteOutlineFilter strokeColor={routeColor} outlineColor={outlineColor} />
            <DirectionArrows route={route} color={outlineColor} />
            <StartEndMarkers route={route} color={routeColor} />
          </>
        )}

        {/* Progress: a plain thin line, deliberately far simpler than the
            route above it — it's an overlay showing how far along, not
            a second route competing for attention. */}
        {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: PROGRESS_COLOR, weight: 3, opacity: 1 }} />}
        {current && <CurrentLocationMarker position={current} live={!ended} />}

        <FitOnData route={route} trail={trail} current={current} cardPadding={cardPadding} />
        <ResizeHandler />
        <ZoomControl position="topright" />
        <RecenterControl target={current} />
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
