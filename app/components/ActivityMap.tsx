'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'proj4leaflet';
import { ActivityData } from '@/lib/types';
import { OS_DEFAULT_CENTER, type BaseMap } from '@/lib/map-config';
import { getActivityColor } from '@/lib/activity-categories';
import { trimRouteEnds } from '@/lib/route-trim';
import { resolveOsBaseMap, OsTileLadder } from './map/OsTileLadder';
import { RouteOutlineFilter, StartEndMarkers, DirectionArrows } from './map/RouteDecorations';
import PhotoOverlay from './PhotoOverlay';
import TextOverlay from './TextOverlay';

interface ActivityMapProps {
  activity: ActivityData;
  width: number;
  height: number;
  paddingRight?: number;
  onPinClick?: (index: number) => void;
  baseMap?: BaseMap;
  osDark?: boolean;
  hidePhotos?: boolean;
  hideDetails?: boolean;
  hideDescription?: boolean;
  hillshadeEnabled?: boolean;
  hideStartEnd?: boolean;
  /** When set, positions the map with setView instead of fitBounds */
  centerZoom?: { center: [number, number]; zoom: number };
}

function MapController({
  route,
  paddingRight = 0,
  paddingBottom = 0,
  centerZoom,
}: {
  route: [number, number][];
  paddingRight?: number;
  paddingBottom?: number;
  centerZoom?: { center: [number, number]; zoom: number };
}) {
  const map = useMap();

  useEffect(() => {
    if (centerZoom) {
      map.setView(centerZoom.center, centerZoom.zoom);
    } else if (route.length > 0) {
      const bounds = L.latLngBounds(route.map(([lat, lng]) => [lat, lng]));

      // Drop all extra padding if it would push zoom below 6 (tile quality threshold)
      let effectivePaddingRight = paddingRight;
      let effectivePaddingBottom = paddingBottom;
      if (paddingRight > 0 || paddingBottom > 0) {
        const zoomWith = map.getBoundsZoom(bounds, false, L.point(paddingRight + 60, paddingBottom + 60));
        const zoomWithout = map.getBoundsZoom(bounds, false, L.point(60, 60));
        if (zoomWith < 6 && zoomWithout >= 6) {
          effectivePaddingRight = 0;
          effectivePaddingBottom = 0;
        }
      }

      map.fitBounds(bounds, {
        paddingTopLeft: [30, 30] as L.PointExpression,
        paddingBottomRight: [effectivePaddingRight + 30, effectivePaddingBottom + 30] as L.PointExpression,
      });
    }
  }, [map, route, paddingRight, paddingBottom, centerZoom]);

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

export default function ActivityMap({ activity, width, height, paddingRight = 0, onPinClick, baseMap = 'os', osDark = false, hidePhotos = false, hideDetails = false, hideDescription = false, hillshadeEnabled = false, hideStartEnd = false, centerZoom }: ActivityMapProps) {
  const extraBottomPadding = hideDetails ? 0 : 60;

  const finiteRoute = activity.route.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)
  );
  const route = hideStartEnd ? trimRouteEnds(finiteRoute, 250) : finiteRoute;

  const center: [number, number] = route.length > 0
    ? route[Math.floor(route.length / 2)]
    : [OS_DEFAULT_CENTER.lat, OS_DEFAULT_CENTER.lng];

  const isSatellite = baseMap === 'satellite';
  const { crs: activeCRS, tileUrl, minZoom, maxZoom, isInGB } = resolveOsBaseMap(center, { satellite: isSatellite, osDark });

  const isDark = isSatellite || osDark;
  const routeColor = getActivityColor(activity.type ?? '');
  const routeOutlineColor = isDark ? 'rgba(7,14,20,0.65)' : 'rgba(7,14,20,0.82)';
  const routeOpacity = 0.68;

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
        <OsTileLadder tileUrl={tileUrl} isInGB={isInGB} />
        {hillshadeEnabled && !isSatellite && isInGB && (
          <TileLayer
            key={String(osDark)}
            url={`/api/hillshade27700?z={z}&x={x}&y={y}${osDark ? '&dark=1' : ''}`}
            maxNativeZoom={9}
            minZoom={6}
            zIndex={2}
          />
        )}
        <Polyline
          positions={route}
          pathOptions={{
            color: routeColor,
            weight: 9,
            opacity: routeOpacity,
          }}
        />
        <RouteOutlineFilter strokeColor={routeColor} outlineColor={routeOutlineColor} />
        <DirectionArrows route={route} color={routeOutlineColor} opacity={1} />
        <StartEndMarkers route={route} color={routeColor} />
        <MapController route={route} paddingRight={paddingRight ?? 0} paddingBottom={extraBottomPadding} centerZoom={centerZoom} />
        <TileLoadHandler />
        {!hidePhotos && <PhotoOverlay photos={activity.photos} onPinClick={onPinClick} isDark={isDark} />}
      </MapContainer>
      {!hideDetails && <TextOverlay activity={activity} baseMap={baseMap} osDark={osDark} hideDescription={hideDescription} />}
    </div>
  );
}
