'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
      map.fitBounds(bounds, { padding: [40, 40] });
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
    : [37.7749, -122.4194];

  return (
    <div style={{ width, height, position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline
          positions={activity.route}
          pathOptions={{
            color: '#FF4500',
            weight: 4,
            opacity: 0.8,
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
