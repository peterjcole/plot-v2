'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'proj4leaflet';
import { ActivityData } from '@/lib/types';
import { OS_PROJECTION, OS_TILE_URL, OS_DARK_TILE_URL, OS_DEFAULT_CENTER, SATELLITE_TILE_URL, type BaseMap } from '@/lib/map-config';
import PhotoOverlay from './PhotoOverlay';
import TextOverlay from './TextOverlay';


function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function sampleArrowIndices(
  route: [number, number][],
  intervalMeters = 1000,
  maxArrows = 20
): number[] {
  if (route.length < 2) return [];

  // Compute cumulative distances
  const cumDist: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cumDist.push(cumDist[i - 1] + L.latLng(route[i - 1]).distanceTo(L.latLng(route[i])));
  }
  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist < 500) return [];

  const skip = Math.floor(route.length * 0.05);
  const indices: number[] = [];
  let nextTarget = intervalMeters;

  for (let i = skip; i < route.length - skip; i++) {
    if (cumDist[i] >= nextTarget) {
      indices.push(i);
      nextTarget += intervalMeters;
      if (indices.length >= maxArrows) break;
    }
  }
  return indices;
}

// Fix Leaflet default marker icon paths (broken in bundlers)
// Using unpkg CDN for reliable marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// EPSG:27700 British National Grid CRS
const osCRS = new L.Proj.CRS(
  OS_PROJECTION.code,
  OS_PROJECTION.proj4,
  {
    resolutions: OS_PROJECTION.resolutions,
    origin: OS_PROJECTION.origin,
  }
);

interface ActivityMapProps {
  activity: ActivityData;
  width: number;
  height: number;
  paddingRight?: number;
  onPinClick?: (index: number) => void;
  baseMap?: BaseMap;
  osDark?: boolean;
}

function RouteOutlineFilter({ strokeColor, outlineColor }: { strokeColor: string; outlineColor: string }) {
  const map = useMap();

  useEffect(() => {
    const apply = () => {
      const svg = map.getContainer().querySelector('svg');
      if (!svg) return;

      const paths = svg.querySelectorAll('path.leaflet-interactive');
      const routePath = Array.from(paths).find(
        (p) => p.getAttribute('stroke') === strokeColor
      );
      if (!routePath) return;

      let defs = svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
      }

      if (!defs.querySelector('#route-outline')) {
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'route-outline');
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '140%');
        filter.innerHTML = [
          '<feComponentTransfer in="SourceAlpha" result="opaque-alpha">',
          '  <feFuncA type="linear" slope="100" intercept="0"/>',
          '</feComponentTransfer>',
          '<feMorphology in="opaque-alpha" operator="dilate" radius="2" result="dilated"/>',
          `<feFlood flood-color="${outlineColor}" flood-opacity="0.9" result="color"/>`,
          '<feComposite in="color" in2="dilated" operator="in" result="full-outline"/>',
          '<feComposite in="full-outline" in2="opaque-alpha" operator="out" result="border-only"/>',
          '<feMerge>',
          '  <feMergeNode in="border-only"/>',
          '  <feMergeNode in="SourceGraphic"/>',
          '</feMerge>',
        ].join('');
        defs.appendChild(filter);
      }

      routePath.setAttribute('filter', 'url(#route-outline)');
    };

    // Apply after initial render and reapply on zoom/pan (Leaflet recreates SVG paths)
    const timer = setTimeout(apply, 500);
    map.on('moveend', apply);

    return () => {
      clearTimeout(timer);
      map.off('moveend', apply);
    };
  }, [map]);

  return null;
}

function StartEndMarkers({ route, color }: { route: [number, number][]; color: string }) {
  const map = useMap();

  useEffect(() => {
    if (route.length === 0) return;

    const startIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:16px;height:16px;border-radius:50%;
        background:${color};
        border:2.5px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,0.45);
        box-sizing:border-box;
        opacity:0.75;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const endIcon = L.divIcon({
      className: '',
      html: `<svg width="16" height="16" viewBox="0 0 16 16" style="display:block"><defs><clipPath id="end-checker-clip"><circle cx="8" cy="8" r="6"/></clipPath></defs><g clip-path="url(#end-checker-clip)"><rect x="2" y="2" width="6" height="6" fill="${color}"/><rect x="8" y="2" width="6" height="6" fill="white"/><rect x="2" y="8" width="6" height="6" fill="white"/><rect x="8" y="8" width="6" height="6" fill="${color}"/></g><circle cx="8" cy="8" r="6" fill="none" stroke="white" stroke-width="2"/></svg>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const startMarker = L.marker(route[0], { icon: startIcon, interactive: false, zIndexOffset: 1000 });
    const endMarker = L.marker(route[route.length - 1], { icon: endIcon, interactive: false, zIndexOffset: 0 });

    startMarker.addTo(map);
    endMarker.addTo(map);

    return () => {
      startMarker.remove();
      endMarker.remove();
    };
  }, [map, route, color]);

  return null;
}

function DirectionArrows({ route, color }: { route: [number, number][]; color: string }) {
  const map = useMap();

  useEffect(() => {
    const indices = sampleArrowIndices(route, 2000);
    if (indices.length === 0) return;

    const markers = indices.map((idx) => {
      const ahead = Math.min(idx + 5, route.length - 1);
      const deg = bearing(route[idx][0], route[idx][1], route[ahead][0], route[ahead][1]);
      const icon = L.divIcon({
        className: '',
        html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="display:block;transform:rotate(${deg}deg)"><path d="M18 15 L12 9 L6 15" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      return L.marker(route[idx], { icon, interactive: false }).addTo(map);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, route, color]);

  return null;
}

function MapController({ route, paddingRight = 0 }: { route: [number, number][]; paddingRight?: number }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0) {
      const bounds = L.latLngBounds(route.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, {
        paddingTopLeft: [50, 50] as L.PointExpression,
        paddingBottomRight: [paddingRight + 50, 50] as L.PointExpression,
      });
    }
  }, [map, route, paddingRight]);

  return null;
}

function TileLoadHandler() {
  const map = useMap();
  const tilesLoadedRef = useRef(false);

  useEffect(() => {
    const handleTileLoad = () => {
      if (!tilesLoadedRef.current) {
        tilesLoadedRef.current = true;
        // Give a small delay for any final rendering
        setTimeout(() => {
          window.__MAP_READY__ = true;
        }, 300);
      }
    };

    map.on('load', handleTileLoad);

    // Also listen for when all tiles in the current view are loaded
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        layer.on('load', handleTileLoad);
      }
    });

    // Fallback: set ready after timeout
    const fallbackTimeout = setTimeout(() => {
      if (!window.__MAP_READY__) {
        window.__MAP_READY__ = true;
      }
    }, 5000);

    return () => {
      map.off('load', handleTileLoad);
      clearTimeout(fallbackTimeout);
    };
  }, [map]);

  return null;
}

export default function ActivityMap({ activity, width, height, paddingRight = 0, onPinClick, baseMap = 'os', osDark = false }: ActivityMapProps) {
  const route = activity.route.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)
  );

  const center: [number, number] = route.length > 0
    ? route[Math.floor(route.length / 2)]
    : [OS_DEFAULT_CENTER.lat, OS_DEFAULT_CENTER.lng];

  const isSatellite = baseMap === 'satellite';
  const activeCRS = isSatellite ? L.CRS.EPSG3857 : osCRS;
  const tileUrl = isSatellite ? SATELLITE_TILE_URL : osDark ? OS_DARK_TILE_URL : OS_TILE_URL;
  const minZoom = isSatellite ? 2 : 6;
  const maxZoom = isSatellite ? 18 : 9;

  // Satellite: accent orange (#D4872B — OS contour-orange token) with dark brown outline
  // OS: primary green with dark green outline
  const routeColor = isSatellite ? '#D4872B' : '#4A5A2B';
  const routeOutlineColor = isSatellite ? '#5A2D00' : '#3A4722';
  const routeOpacity = 0.35;

  return (
    <div style={{ width, height, position: 'relative', colorScheme: 'only light' }}>
      <MapContainer
        key={baseMap}
        center={center}
        zoom={7}
        minZoom={minZoom}
        maxZoom={maxZoom}
        crs={activeCRS}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={tileUrl}
          maxNativeZoom={isSatellite ? 18 : 9}
          {...(!isSatellite && { minNativeZoom: 8 })}
        />
        <Polyline
          positions={route}
          pathOptions={{
            color: routeColor,
            weight: 5,
            opacity: routeOpacity,
          }}
        />
        <RouteOutlineFilter strokeColor={routeColor} outlineColor={routeOutlineColor} />
        <DirectionArrows route={route} color={routeOutlineColor} />
        <StartEndMarkers route={route} color={routeColor} />
        <MapController route={route} paddingRight={paddingRight} />
        <TileLoadHandler />
        <PhotoOverlay photos={activity.photos} onPinClick={onPinClick} />
      </MapContainer>
      <TextOverlay activity={activity} baseMap={baseMap} />
    </div>
  );
}
