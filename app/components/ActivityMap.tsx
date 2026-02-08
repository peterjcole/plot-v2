'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'proj4leaflet';
import { ActivityData } from '@/lib/types';
import PhotoOverlay from './PhotoOverlay';
import TextOverlay from './TextOverlay';

// Fix Leaflet default marker icon paths (broken in bundlers)
// Using unpkg CDN for reliable marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// EPSG:27700 British National Grid CRS
const crs = new L.Proj.CRS(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs',
  {
    resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
    origin: [-238375.0, 1376256.0],
  }
);

interface ActivityMapProps {
  activity: ActivityData;
  width: number;
  height: number;
}

function RouteOutlineFilter() {
  const map = useMap();

  useEffect(() => {
    const apply = () => {
      const svg = map.getContainer().querySelector('svg');
      if (!svg) return;

      // Find the route polyline by stroke color
      const paths = svg.querySelectorAll('path.leaflet-interactive');
      const routePath = Array.from(paths).find(
        (p) => p.getAttribute('stroke') === '#080357'
      );
      if (!routePath) return;

      // Inject filter defs into Leaflet's SVG
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
          '<feFlood flood-color="#333333" flood-opacity="0.9" result="color"/>',
          '<feComposite in="color" in2="dilated" operator="in" result="full-outline"/>',
          // Subtract original stroke area so outline only appears outside
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

function MapController({ route }: { route: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (route.length > 0) {
      const bounds = L.latLngBounds(route.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, route]);

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

export default function ActivityMap({ activity, width, height }: ActivityMapProps) {
  const route = activity.route.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)
  );

  const center: [number, number] = route.length > 0
    ? route[Math.floor(route.length / 2)]
    : [54.4, -2.9];

  return (
    <div style={{ width, height, position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={7}
        minZoom={6}
        maxZoom={9}
        crs={crs}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="/api/maps?z={z}&x={x}&y={y}"
          maxNativeZoom={9}
          minNativeZoom={8}
        />
        <Polyline
          positions={route}
          pathOptions={{
            color: '#080357',
            weight: 4,
            opacity: 0.2,
          }}
        />
        <RouteOutlineFilter />
        <MapController route={route} />
        <TileLoadHandler />
        <PhotoOverlay photos={activity.photos} />
      </MapContainer>
      <TextOverlay activity={activity} />
    </div>
  );
}
