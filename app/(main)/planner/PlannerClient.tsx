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
import { Plus, Minus, CircleArrowUp } from 'lucide-react';
import Logo from '@/app/components/Logo';
import PlannerToolbar from './PlannerToolbar';
import PlaceSearch from './PlaceSearch';
import LayersPanel from './LayersPanel';
import HeatmapActivityPopup from './HeatmapActivityPopup';
import PhotoPopup from './PhotoPopup';
import { Waypoint, HeatmapActivity, PhotoItem } from '@/lib/types';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { OS_PROJECTION, type BaseMap } from '@/lib/map-config';
import 'ol/ol.css';

const PlannerMap = dynamic(() => import('./PlannerMap'), { ssr: false });

// Returns the bearing (degrees CW from true north) of the projected +Y axis at the
// current map centre — i.e. how far "grid north" deviates from geographic north.
// Needed because EPSG:27700 is centred on 2°W; the deviation is ~78° at US longitudes.
function computeGridNorthBearing(center: number[]): number {
  const c = transform(center, OS_PROJECTION.code, 'EPSG:4326') as [number, number];
  const n = transform([center[0], center[1] + 1000], OS_PROJECTION.code, 'EPSG:4326') as [number, number];
  const toRad = Math.PI / 180;
  const φ1 = c[1] * toRad, φ2 = n[1] * toRad, Δλ = (n[0] - c[0]) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

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
  const [hillshadeEnabled, setHillshadeEnabled] = useState(() => savedHeatmapPrefs?.hillshadeEnabled ?? true);
  const [poisEnabled, setPoisEnabled] = useState(() => savedHeatmapPrefs?.poisEnabled ?? false);
  const [photosEnabled, setPhotosEnabled] = useState(() => savedHeatmapPrefs?.photosEnabled ?? false);
  const photosImportTriggeredRef = useRef(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [mapRotation, setMapRotation] = useState(0); // radians, 0 = north up
  const [gridNorthBearing, setGridNorthBearing] = useState(0); // degrees CW from true north to grid north
  const [activityPopup, setActivityPopup] = useState<{
    activities: HeatmapActivity[];
    screenX: number;
    screenY: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [hoveredActivityRoute, setHoveredActivityRoute] = useState<[number, number][] | null>(null);
  const [hoveredActivityColor, setHoveredActivityColor] = useState<string | null>(null);
  const [photoPopup, setPhotoPopup] = useState<{ photo: PhotoItem; screenX: number; screenY: number } | null>(null);
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
        poisEnabled,
        photosEnabled,
      }));
    } catch { /* ignore */ }
  }, [baseMap, osMapMode, osMapFollowSystem, heatmapEnabled, heatmapSport, heatmapColor, dimBaseMap, personalHeatmapEnabled, explorerEnabled, explorerFilter, hillshadeEnabled, poisEnabled, photosEnabled]);

  // Check personal tile availability
  useEffect(() => {
    fetch('/api/tiles/meta')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setPersonalTilesAvailable(data?.available ?? false))
      .catch(() => setPersonalTilesAvailable(false));
  }, []);

  // Trigger photo catch-up import the first time "My photos" is enabled
  useEffect(() => {
    if (!photosEnabled || photosImportTriggeredRef.current) return;
    try {
      if (localStorage.getItem('plotv2-photos-import-triggered')) {
        photosImportTriggeredRef.current = true;
        return;
      }
    } catch { /* ignore */ }
    photosImportTriggeredRef.current = true;
    fetch('/api/photos/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((res) => {
        if (res.ok) {
          try { localStorage.setItem('plotv2-photos-import-triggered', '1'); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* silently ignore */ });
  }, [photosEnabled]);

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
          zoom ?? 7,
          view.getRotation()
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

  const handleFitToRoute = useCallback((wps: Waypoint[]) => {
    const map = mapInstanceRef.current;
    if (!map || wps.length < 2) return;
    const coords = wps.map((wp) => fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code));
    const extent = boundingExtent(coords);
    map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 500, maxZoom: 9 });
  }, []);

  const handleMapReady = useCallback((map: Map) => {
    mapInstanceRef.current = map;

    // Restore saved viewport
    const stored = loadRoute();
    if (stored && stored.mapCenter[0] !== 0) {
      map.getView().setCenter(stored.mapCenter);
      map.getView().setZoom(stored.mapZoom);
      if (stored.mapRotation != null) {
        map.getView().setRotation(stored.mapRotation);
        setMapRotation(stored.mapRotation);
      }
    } else if (stored && stored.waypoints.length >= 2) {
      handleFitToRoute(stored.waypoints as Waypoint[]);
    }

    // Persist map position whenever the user pans or zooms
    map.on('moveend', () => {
      const view = map.getView();
      const center = view.getCenter();
      const zoom = view.getZoom();
      if (center && zoom != null) {
        saveRoute(waypointsRef.current, segmentsRef.current, center as [number, number], zoom, view.getRotation());
      }
      if (center) setGridNorthBearing(computeGridNorthBearing(center));
    });

    // Keep compass in sync with map rotation
    map.getView().on('change:rotation', () => {
      setMapRotation(map.getView().getRotation());
    });

    // Initial bearing for current centre
    const initialCenter = map.getView().getCenter();
    if (initialCenter) setGridNorthBearing(computeGridNorthBearing(initialCenter));
  }, [handleFitToRoute]);

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
        const rotation = computeGridNorthBearing(coord) * Math.PI / 180;
        map.getView().animate({ center: coord, zoom: 8, rotation, duration: 500 });
      },
      () => {
        // Silently fail if geolocation is denied
      }
    );
  }, []);

  const handleResetRotation = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = map.getView().getCenter();
    const rotation = center ? computeGridNorthBearing(center) * Math.PI / 180 : 0;
    map.getView().animate({ rotation, duration: 300 });
  }, []);

  const handlePlaceSelect = useCallback((coordinates: [number, number]) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = fromLonLat(coordinates, OS_PROJECTION.code);
    const rotation = computeGridNorthBearing(center) * Math.PI / 180;
    map.getView().animate({ center, zoom: 8, rotation, duration: 500 });
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

  const handlePhotoClick = useCallback((photo: PhotoItem, screenX: number, screenY: number) => {
    setActivityPopup(null);
    setPhotoPopup({ photo, screenX, screenY });
  }, []);

  const handlePhotoRouteHighlight = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/tiles/activities?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setHoveredActivityRoute(data[0].route);
          setHoveredActivityColor(null);
        }
      }
    } catch { /* ignore */ }
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
  }, [baseMap, osDark, hillshadeEnabled, segments]);

  // Compass angle: 0 = true north is up. Used for both display and hide logic.
  const compassDeg = ((mapRotation * 180 / Math.PI - gridNorthBearing) % 360 + 360) % 360;

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
        onCloseActivityPopup={() => { setActivityPopup(null); setHoveredActivityRoute(null); setHoveredActivityColor(null); }}
        hoveredActivityRoute={hoveredActivityRoute}
        hoveredActivityColor={hoveredActivityColor}
        poisEnabled={poisEnabled}
        photosEnabled={photosEnabled}
        onPhotoClick={handlePhotoClick}
      />
      {activityPopup && (
        <HeatmapActivityPopup
          activities={activityPopup.activities}
          screenX={activityPopup.screenX}
          screenY={activityPopup.screenY}
          isLoading={popupLoading}
          onClose={() => { setActivityPopup(null); setHoveredActivityRoute(null); setHoveredActivityColor(null); }}
          onHoverActivity={(route, color) => { setHoveredActivityRoute(route); setHoveredActivityColor(color ?? null); }}
        />
      )}
      {photoPopup && (
        <PhotoPopup
          photo={photoPopup.photo}
          screenX={photoPopup.screenX}
          screenY={photoPopup.screenY}
          onClose={() => { setPhotoPopup(null); setHoveredActivityRoute(null); }}
          onHighlightRoute={handlePhotoRouteHighlight}
        />
      )}
      {/* Logo panel — desktop only */}
      <Link
        href="/"
        className="absolute top-3 left-3 z-10 hidden sm:flex bg-surface-raised/70 backdrop-blur-sm rounded-xl shadow-lg border border-border"
      >
        <Logo size="sm" />
      </Link>
      {/* Compass — only visible when map is rotated away from north */}
      {compassDeg > 0.1 && compassDeg < 359.9 && (
        <button
          onClick={handleResetRotation}
          title="Reset rotation"
          className="absolute bottom-[128px] right-3 z-20 flex items-center justify-center w-11 h-11 rounded-lg bg-surface-raised/70 backdrop-blur-md shadow-lg border border-border text-text-primary hover:bg-surface-muted transition-colors"
        >
          <CircleArrowUp
            size={18}
            style={{ transform: `rotate(${compassDeg}deg)`, transition: 'transform 0.15s' }}
          />
        </button>
      )}
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
        poisEnabled={poisEnabled}
        onPoisEnabledChange={setPoisEnabled}
        photosEnabled={photosEnabled}
        onPhotosEnabledChange={setPhotosEnabled}
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
