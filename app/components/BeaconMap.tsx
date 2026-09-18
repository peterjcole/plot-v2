'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'proj4leaflet';
import { OS_PROJECTION, OS_DEFAULT_CENTER, OS_TILE_URL } from '@/lib/map-config';

// A deliberately lighter sibling of app/components/ActivityMap.tsx, not a
// reuse of it — ActivityMap is built around a finished `ActivityData`
// (photos, description overlay, activity-type colouring) that a live,
// possibly-still-running beacon doesn't have. What's shared is the thing
// that actually matters for correctness: the same EPSG:27700 CRS/tile setup,
// so a beacon route lands on the identical map both apps already agree on.
const osCRS = new L.Proj.CRS(OS_PROJECTION.code, OS_PROJECTION.proj4, {
  resolutions: OS_PROJECTION.resolutions,
  origin: OS_PROJECTION.origin,
});

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

interface BeaconMapProps {
  route: [number, number][];
  trail: [number, number][];
  current: [number, number] | null;
}

function FitOnData({ route, trail, current }: BeaconMapProps) {
  const map = useMap();
  useEffect(() => {
    const points = [...route, ...trail, ...(current ? [current] : [])];
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
    // Deliberately only on mount / when the point *set* first becomes
    // non-empty-ish — re-fitting on every 30s poll would yank the view out
    // from under someone who's zoomed in to check progress near the front.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, route.length > 0, trail.length > 0]);
  return null;
}

export default function BeaconMap({ route, trail, current }: BeaconMapProps) {
  const center: [number, number] = current ?? route[0] ?? trail[0] ?? [OS_DEFAULT_CENTER.lat, OS_DEFAULT_CENTER.lng];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', colorScheme: 'only light' }}>
      <MapContainer
        center={center}
        zoom={7}
        minZoom={0}
        maxZoom={9}
        crs={osCRS}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer url={OS_TILE_URL} minZoom={6} maxNativeZoom={9} minNativeZoom={8} />
        <TileLayer url={OS_TILE_URL} minZoom={4} maxZoom={5} minNativeZoom={6} maxNativeZoom={9} />
        <TileLayer url={OS_TILE_URL} minZoom={3} maxZoom={3} minNativeZoom={4} maxNativeZoom={9} />
        <TileLayer url={OS_TILE_URL} maxZoom={2} maxNativeZoom={9} />
        {route.length > 1 && (
          <Polyline positions={route} pathOptions={{ color: '#2A5860', weight: 5, opacity: 0.6, dashArray: '2 8' }} />
        )}
        {trail.length > 1 && (
          <Polyline positions={trail} pathOptions={{ color: '#E07020', weight: 5, opacity: 0.85 }} />
        )}
        {current && (
          <CircleMarker
            center={current}
            radius={8}
            pathOptions={{ color: 'white', weight: 2, fillColor: '#E07020', fillOpacity: 1 }}
          />
        )}
        <FitOnData route={route} trail={trail} current={current} />
      </MapContainer>
    </div>
  );
}
