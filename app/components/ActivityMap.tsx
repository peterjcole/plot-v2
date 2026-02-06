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
  const center: [number, number] = activity.route.length > 0
    ? activity.route[Math.floor(activity.route.length / 2)]
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
          positions={activity.route}
          pathOptions={{
            color: '#080357',
            weight: 4,
            opacity: 0.5,
          }}
        />
        <MapController route={activity.route} />
        <TileLoadHandler />
        <PhotoOverlay photos={activity.photos} />
      </MapContainer>
      <TextOverlay activity={activity} />
    </div>
  );
}
