'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import { useRouteHistory } from './useRouteHistory';
import { useRouteSnapping } from './useRouteSnapping';
import { useElevationProfile } from './useElevationProfile';
import type { ElevationHoverPoint } from './ElevationChart';
import { calculateDistance } from './route-utils';
import Link from 'next/link';
import { Plus, Minus } from 'lucide-react';
import Logo from '@/app/components/Logo';
import PlannerToolbar from './PlannerToolbar';
import PlaceSearch from './PlaceSearch';
import LayersPanel from './LayersPanel';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { OS_PROJECTION } from '@/lib/map-config';
import 'ol/ol.css';

const PlannerMap = dynamic(() => import('./PlannerMap'), { ssr: false });

export default function PlannerClient() {
  const { waypoints, segments, canUndo, canRedo, dispatch } = useRouteHistory();
  const [addPointsEnabled, setAddPointsEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  useRouteSnapping({ waypoints, segments, dispatch });
  const { elevationData, isLoading: isLoadingElevation } = useElevationProfile(waypoints, segments);
  const [hoveredElevationPoint, setHoveredElevationPoint] = useState<ElevationHoverPoint | null>(null);

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
  const [personalHeatmapEnabled, setPersonalHeatmapEnabled] = useState(() => savedHeatmapPrefs?.personalHeatmapEnabled ?? false);
  const [personalTilesAvailable, setPersonalTilesAvailable] = useState<boolean | null>(null);
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
        personalHeatmapEnabled,
      }));
    } catch { /* ignore */ }
  }, [heatmapEnabled, heatmapSport, heatmapColor, dimBaseMap, personalHeatmapEnabled]);

  // Check personal tile availability
  useEffect(() => {
    fetch('/api/tiles/meta')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setPersonalTilesAvailable(data?.available ?? false))
      .catch(() => setPersonalTilesAvailable(false));
  }, []);

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

  const handlePlaceSelect = useCallback((coordinates: [number, number]) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = fromLonLat(coordinates, OS_PROJECTION.code);
    map.getView().animate({ center, zoom: 8, duration: 500 });
  }, []);

  const handleZoomIn = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    view.animate({ zoom: (view.getZoom() ?? 7) + 1, duration: 200 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    view.animate({ zoom: (view.getZoom() ?? 7) - 1, duration: 200 });
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
        personalHeatmapEnabled={personalHeatmapEnabled}
        hoveredElevationPoint={hoveredElevationPoint}
      />
      {/* Logo panel — desktop only */}
      <Link
        href="/"
        className="absolute top-3 left-3 z-10 hidden sm:flex bg-surface-raised/70 backdrop-blur-sm rounded-xl shadow-lg border border-border"
      >
        <Logo size="sm" />
      </Link>
      {/* Zoom controls — bottom-left, above layers button */}
      <div className="absolute bottom-[72px] left-3 z-10 flex flex-col bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border overflow-hidden">
        <button
          onClick={handleZoomIn}
          title="Zoom in"
          className="flex items-center justify-center w-11 h-11 text-text-primary hover:bg-surface-muted transition-colors"
        >
          <Plus size={18} />
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={handleZoomOut}
          title="Zoom out"
          className="flex items-center justify-center w-11 h-11 text-text-primary hover:bg-surface-muted transition-colors"
        >
          <Minus size={18} />
        </button>
      </div>
      <LayersPanel
        heatmapEnabled={heatmapEnabled}
        onHeatmapEnabledChange={setHeatmapEnabled}
        heatmapSport={heatmapSport}
        onHeatmapSportChange={setHeatmapSport}
        heatmapColor={heatmapColor}
        onHeatmapColorChange={setHeatmapColor}
        dimBaseMap={dimBaseMap}
        onDimBaseMapChange={setDimBaseMap}
        personalHeatmapEnabled={personalHeatmapEnabled}
        onPersonalHeatmapEnabledChange={setPersonalHeatmapEnabled}
        personalTilesAvailable={personalTilesAvailable}
      />
      <PlaceSearch onSelect={handlePlaceSelect} />
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
        elevationData={elevationData}
        isLoadingElevation={isLoadingElevation}
        onElevationHover={setHoveredElevationPoint}
      />
    </div>
  );
}
