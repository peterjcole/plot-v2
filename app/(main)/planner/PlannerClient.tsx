'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import { useRouteHistory } from './useRouteHistory';
import { calculateDistance } from './route-utils';
import PlannerToolbar from './PlannerToolbar';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { OS_PROJECTION } from '@/lib/map-config';
import 'ol/ol.css';

const PlannerMap = dynamic(() => import('./PlannerMap'), { ssr: false });

export default function PlannerClient() {
  const { waypoints, canUndo, canRedo, dispatch } = useRouteHistory();
  const mapInstanceRef = useRef<Map | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved route on mount
  useEffect(() => {
    const stored = loadRoute();
    if (stored && stored.waypoints.length > 0) {
      dispatch({ type: 'LOAD', waypoints: stored.waypoints });
    }
  }, [dispatch]);

  // Auto-save route (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const map = mapInstanceRef.current;
      if (map) {
        const view = map.getView();
        const center = view.getCenter();
        const zoom = view.getZoom();
        saveRoute(
          waypoints,
          (center as [number, number]) ?? [0, 0],
          zoom ?? 7
        );
      } else {
        saveRoute(waypoints, [0, 0], 7);
      }
    }, 500);
  }, [waypoints]);

  const distance = useMemo(() => calculateDistance(waypoints), [waypoints]);

  const handleMapReady = useCallback((map: Map) => {
    mapInstanceRef.current = map;

    // Restore saved viewport
    const stored = loadRoute();
    if (stored && stored.mapCenter[0] !== 0) {
      map.getView().setCenter(stored.mapCenter);
      map.getView().setZoom(stored.mapZoom);
    }
  }, []);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const coord = fromLonLat(
          [pos.coords.longitude, pos.coords.latitude],
          OS_PROJECTION.code
        );
        map.getView().animate({ center: coord, zoom: 8, duration: 500 });
      },
      () => {
        // Silently fail if geolocation is denied
      }
    );
  }, []);

  return (
    <div className="fixed inset-0">
      <PlannerMap
        waypoints={waypoints}
        dispatch={dispatch}
        onMapReady={handleMapReady}
      />
      <PlannerToolbar
        waypoints={waypoints}
        distance={distance}
        canUndo={canUndo}
        canRedo={canRedo}
        dispatch={dispatch}
        onGeolocate={handleGeolocate}
      />
    </div>
  );
}
