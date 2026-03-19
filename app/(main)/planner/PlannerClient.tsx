'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type Map from 'ol/Map';
import { fromLonLat, transform } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
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
import HeatmapActivityPopup from './HeatmapActivityPopup';
import { Waypoint, HeatmapActivity } from '@/lib/types';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { OS_PROJECTION, type BaseMap } from '@/lib/map-config';
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

  const [baseMap, setBaseMap] = useState<BaseMap>(() => savedHeatmapPrefs?.baseMap ?? 'os');
  const [osMapMode, setOsMapMode] = useState<'light' | 'dark'>(() => savedHeatmapPrefs?.osMapMode ?? 'light');
  const [osMapFollowSystem, setOsMapFollowSystem] = useState<boolean>(() => savedHeatmapPrefs?.osMapFollowSystem ?? true);
  const [systemDark, setSystemDark] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(() => savedHeatmapPrefs?.enabled ?? false);
  const [heatmapSport, setHeatmapSport] = useState<string>(() => savedHeatmapPrefs?.sport ?? 'all');
  const [heatmapColor, setHeatmapColor] = useState<string>(() => savedHeatmapPrefs?.color ?? 'blue');
  const [dimBaseMap, setDimBaseMap] = useState(() => savedHeatmapPrefs?.dimBaseMap ?? false);
  const [personalHeatmapEnabled, setPersonalHeatmapEnabled] = useState(() => savedHeatmapPrefs?.personalHeatmapEnabled ?? false);
  const [explorerEnabled, setExplorerEnabled] = useState(() => savedHeatmapPrefs?.explorerEnabled ?? false);
  const [explorerFilter, setExplorerFilter] = useState<string>(() => savedHeatmapPrefs?.explorerFilter ?? 'all');
  const [personalTilesAvailable, setPersonalTilesAvailable] = useState<boolean | null>(null);
  const [hillshadeEnabled, setHillshadeEnabled] = useState(() => savedHeatmapPrefs?.hillshadeEnabled ?? false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [activityPopup, setActivityPopup] = useState<{
    activities: HeatmapActivity[];
    screenX: number;
    screenY: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [hoveredActivityRoute, setHoveredActivityRoute] = useState<[number, number][] | null>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mutable refs so moveend handler always reads current route without stale closures
  const waypointsRef = useRef(waypoints);
  const segmentsRef = useRef(segments);
  waypointsRef.current = waypoints;
  segmentsRef.current = segments;

  // Detect system dark mode preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const osDark = baseMap === 'os' && (osMapFollowSystem ? systemDark : osMapMode === 'dark');

  // Persist heatmap preferences
  useEffect(() => {
    try {
      localStorage.setItem('plotv2-heatmap-prefs', JSON.stringify({
        baseMap,
        osMapMode,
        osMapFollowSystem,
        enabled: heatmapEnabled,
        sport: heatmapSport,
        color: heatmapColor,
        dimBaseMap,
        personalHeatmapEnabled,
        explorerEnabled,
        explorerFilter,
        hillshadeEnabled,
      }));
    } catch { /* ignore */ }
  }, [baseMap, osMapMode, osMapFollowSystem, heatmapEnabled, heatmapSport, heatmapColor, dimBaseMap, personalHeatmapEnabled, explorerEnabled, explorerFilter, hillshadeEnabled]);

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

    // Persist map position whenever the user pans or zooms
    map.on('moveend', () => {
      const view = map.getView();
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (center && zoom != null) {
        saveRoute(waypointsRef.current, segmentsRef.current, center as [number, number], zoom);
      }
    });
  }, []);

  const handleFitToRoute = useCallback((wps: Waypoint[]) => {
    const map = mapInstanceRef.current;
    if (!map || wps.length < 2) return;
    const coords = wps.map((wp) => fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code));
    const extent = boundingExtent(coords);
    map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 500, maxZoom: 9 });
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

  const handleHeatmapClick = useCallback(async (lat: number, lng: number, screenX: number, screenY: number) => {
    // Same point click → toggle close
    if (activityPopup && Math.abs(activityPopup.lat - lat) < 0.0001 && Math.abs(activityPopup.lng - lng) < 0.0001) {
      setActivityPopup(null);
      setHoveredActivityRoute(null);
      return;
    }
    setActivityPopup({ activities: [], screenX, screenY, lat, lng });
    setPopupLoading(true);
    setHoveredActivityRoute(null);
    try {
      const res = await fetch(`/api/tiles/activities?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setActivityPopup((prev) => prev ? { ...prev, activities: data } : null);
      } else {
        setActivityPopup(null);
      }
    } catch {
      setActivityPopup(null);
    } finally {
      setPopupLoading(false);
    }
  }, [activityPopup]);

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

  const handleExportImage = useCallback(async () => {
    const map = mapInstanceRef.current;
    const view = map?.getView();
    const center27700 = view?.getCenter();
    const olZoom = view?.getZoom() ?? 7;

    const exportMode =
      baseMap === 'satellite'            ? 'satellite'  :
      (olZoom >= 5.4 && olZoom < 6)     ? 'landranger' :
                                           'explorer';
    console.log('[export] OL zoom:', olZoom, '→ exportMode:', exportMode);

    // Convert center from EPSG:27700 → WGS84
    const wgs84Center = center27700
      ? transform(center27700, 'EPSG:27700', 'EPSG:4326')
      : [-2.9, 54.4];
    const center: [number, number] = [wgs84Center[1], wgs84Center[0]]; // [lat, lng]

    // Flatten all segment coordinates (already WGS84)
    const route = segments.flatMap((s) =>
      s.coordinates.map((c) => [c.lat, c.lng] as [number, number])
    );

    setIsExportingImage(true);
    try {
      const res = await fetch('/api/planner-printout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route, center, exportMode, baseMap, osDark, hillshadeEnabled }),
      });

      if (!res.ok) {
        console.error('Image export failed:', await res.text());
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'route.jpg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Image export error:', err);
    } finally {
      setIsExportingImage(false);
    }
  }, [baseMap, osDark, segments]);

  return (
    <div className="fixed inset-0">
      <PlannerMap
        waypoints={waypoints}
        segments={segments}
        dispatch={dispatch}
        onMapReady={handleMapReady}
        addPointsEnabled={addPointsEnabled}
        snapEnabled={snapEnabled}
        baseMap={baseMap}
        osDark={osDark}
        heatmapEnabled={heatmapEnabled}
        heatmapSport={heatmapSport}
        heatmapColor={heatmapColor}
        dimBaseMap={dimBaseMap}
        personalHeatmapEnabled={personalHeatmapEnabled}
        explorerEnabled={explorerEnabled}
        explorerFilter={explorerFilter}
        hoveredElevationPoint={hoveredElevationPoint}
        hillshadeEnabled={hillshadeEnabled}
        onHeatmapClick={handleHeatmapClick}
        onCloseActivityPopup={() => { setActivityPopup(null); setHoveredActivityRoute(null); }}
        hoveredActivityRoute={hoveredActivityRoute}
      />
      {activityPopup && (
        <HeatmapActivityPopup
          activities={activityPopup.activities}
          screenX={activityPopup.screenX}
          screenY={activityPopup.screenY}
          isLoading={popupLoading}
          onClose={() => { setActivityPopup(null); setHoveredActivityRoute(null); }}
          onHoverActivity={setHoveredActivityRoute}
        />
      )}
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
        baseMap={baseMap}
        onBaseMapChange={setBaseMap}
        osMapMode={osMapMode}
        onOsMapModeChange={setOsMapMode}
        osMapFollowSystem={osMapFollowSystem}
        onOsMapFollowSystemChange={setOsMapFollowSystem}
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
        explorerEnabled={explorerEnabled}
        onExplorerEnabledChange={setExplorerEnabled}
        explorerFilter={explorerFilter}
        onExplorerFilterChange={setExplorerFilter}
        hillshadeEnabled={hillshadeEnabled}
        onHillshadeEnabledChange={setHillshadeEnabled}
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
        onFitToRoute={handleFitToRoute}
        onExportImage={handleExportImage}
        isExportingImage={isExportingImage}
      />
    </div>
  );
}
