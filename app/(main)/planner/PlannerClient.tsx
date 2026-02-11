'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import { useRouteHistory } from './useRouteHistory';
import { useRouteSnapping } from './useRouteSnapping';
import { calculateDistance } from './route-utils';
import PlannerToolbar from './PlannerToolbar';
import LayersPanel from './LayersPanel';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { OS_PROJECTION } from '@/lib/map-config';
import 'ol/ol.css';

const PlannerMap = dynamic(() => import('./PlannerMap'), { ssr: false });

export default function PlannerClient() {
  const { waypoints, segments, canUndo, canRedo, dispatch } = useRouteHistory();
  const [addPointsEnabled, setAddPointsEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const { isRouting } = useRouteSnapping({ waypoints, segments, dispatch });

  const savedHeatmapPrefs = useMemo(() => {
    try {
      const raw = localStorage.getItem('plotv2-heatmap-prefs');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  }, []);

  const [heatmapEnabled, setHeatmapEnabled] = useState(() => savedHeatmapPrefs?.enabled ?? false);
  const [heatmapSport, setHeatmapSport] = useState<string>(() => savedHeatmapPrefs?.sport ?? 'all');
  const [heatmapColor, setHeatmapColor] = useState<string>(() => savedHeatmapPrefs?.color ?? 'blue');
  const [dimBaseMap, setDimBaseMap] = useState(() => savedHeatmapPrefs?.dimBaseMap ?? false);
  const mapInstanceRef = useRef<Map | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist heatmap preferences
  useEffect(() => {
    try {
      localStorage.setItem('plotv2-heatmap-prefs', JSON.stringify({
        enabled: heatmapEnabled,
        sport: heatmapSport,
        color: heatmapColor,
        dimBaseMap,
      }));
    } catch { /* ignore */ }
  }, [heatmapEnabled, heatmapSport, heatmapColor, dimBaseMap]);

  // Load saved route on mount
  useEffect(() => {
    const stored = loadRoute();
    if (stored && stored.waypoints.length > 0) {
      dispatch({
        type: 'LOAD',
        waypoints: stored.waypoints,
        segments: stored.segments,
      });
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
          segments,
          (center as [number, number]) ?? [0, 0],
          zoom ?? 7
        );
      } else {
        saveRoute(waypoints, segments, [0, 0], 7);
      }
    }, 500);
  }, [waypoints, segments]);

  const distance = useMemo(
    () => calculateDistance(waypoints, segments),
    [waypoints, segments]
  );

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
        segments={segments}
        dispatch={dispatch}
        onMapReady={handleMapReady}
        addPointsEnabled={addPointsEnabled}
        snapEnabled={snapEnabled}
        heatmapEnabled={heatmapEnabled}
        heatmapSport={heatmapSport}
        heatmapColor={heatmapColor}
        dimBaseMap={dimBaseMap}
      />
      <LayersPanel
        heatmapEnabled={heatmapEnabled}
        onHeatmapEnabledChange={setHeatmapEnabled}
        heatmapSport={heatmapSport}
        onHeatmapSportChange={setHeatmapSport}
        heatmapColor={heatmapColor}
        onHeatmapColorChange={setHeatmapColor}
        dimBaseMap={dimBaseMap}
        onDimBaseMapChange={setDimBaseMap}
      />
      <PlannerToolbar
        waypoints={waypoints}
        segments={segments}
        distance={distance}
        canUndo={canUndo}
        canRedo={canRedo}
        dispatch={dispatch}
        onGeolocate={handleGeolocate}
        addPointsEnabled={addPointsEnabled}
        onToggleAddPoints={() => setAddPointsEnabled((v) => !v)}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled((v) => !v)}
        isRouting={isRouting}
      />
    </div>
  );
}
