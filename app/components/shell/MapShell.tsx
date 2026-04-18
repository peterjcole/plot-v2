'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Map from 'ol/Map';
import { fromLonLat, transform } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
import { ActivitySummary, ActivityData, PhotoItem } from '@/lib/types';
import { type PlannerProps, type WaypointClickInfo, type SegmentTapInfo } from '@/app/components/MainMap';
import LayersPanel, { type LayerState, loadLayerState, saveLayerState } from './LayersPanel';
import { useRouteHistory } from '@/app/(main)/planner/useRouteHistory';
import { useRouteSnapping } from '@/app/(main)/planner/useRouteSnapping';
import { useElevationProfile } from '@/app/(main)/planner/useElevationProfile';
import { calculateDistance } from '@/app/(main)/planner/route-utils';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { selectGpxWaypoints, downloadGpx } from '@/lib/gpx';
import { OS_PROJECTION } from '@/lib/map-config';
import LeftPanel from './LeftPanel';
import BrowsePanel from './BrowsePanel';
import DetailPanel from './DetailPanel';
import PlannerPanel from './PlannerPanel';
import { type ElevationHoverPoint } from '@/app/(main)/planner/ElevationChart';
import UnauthPanel from './UnauthPanel';
import MobileHeader from './MobileHeader';
import MobileBottomSheet from './MobileBottomSheet';
import PlannerToolbar from '@/app/(main)/planner/PlannerToolbar';
import Compass from './Compass';
import ScaleBar from './ScaleBar';
import MapLegend from './MapLegend';
import PhotoLightbox from './PhotoLightbox';
import WaypointPopover from '@/app/components/map/WaypointPopover';
import AboutSection from './AboutSection';
import SplashOverlay from './SplashOverlay';
import SidebarToggle from './SidebarToggle';
import PhotoPopup from '@/app/(main)/planner/PhotoPopup';
import ClusterPhotosPopup from '@/app/(main)/planner/ClusterPhotosPopup';
import HeatmapActivityPopup from '@/app/(main)/planner/HeatmapActivityPopup';
import { useTheme } from './hooks/useTheme';
import { useActivityBrowse } from './hooks/useActivityBrowse';
import { useActivityDetail } from './hooks/useActivityDetail';
import { useLightbox } from './hooks/useLightbox';
import { usePlannerHud, PLANNER_HUD_COLLAPSED, PLANNER_HUD_EXPANDED } from './hooks/usePlannerHud';
import { useMapPopups } from './hooks/useMapPopups';
import { useWaypointInteraction } from './hooks/useWaypointInteraction';

const MainMap = dynamic(() => import('@/app/components/MainMap'), { ssr: false });

export type PanelMode = 'browse' | 'detail' | 'planner' | 'about';


// Real GB BNG coordinates are x ∈ [60000, 700000], y ∈ [10000, 1250000].
// WGS84 lon/lat values for GB (e.g. [8.7, 50.1] for Frankfurt) are tiny by comparison
// and must be rejected to avoid a stale/wrong-format center being applied.
function isValidBNG([x, y]: [number, number]) {
  return x > 60000 && x < 700000 && y > 10000 && y < 1250000;
}

function computeGridNorthBearing(center: number[]): number {
  const c = transform(center, OS_PROJECTION.code, 'EPSG:4326') as [number, number];
  const n = transform([center[0], center[1] + 1000], OS_PROJECTION.code, 'EPSG:4326') as [number, number];
  const toRad = Math.PI / 180;
  const φ1 = c[1] * toRad, φ2 = n[1] * toRad, Δλ = (n[0] - c[0]) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

interface MapShellProps {
  activities: ActivitySummary[];
  avatarInitials: string;
  isLoggedIn?: boolean;
  isOwner?: boolean;
  initialMode?: PanelMode;
  initialSelectedId?: string | null;
  authError?: boolean;
}

export default function MapShell({ activities, avatarInitials, isLoggedIn = false, isOwner = false, initialMode = 'browse', initialSelectedId = null, authError = false }: MapShellProps) {
  const [mode, setMode] = useState<PanelMode>(initialSelectedId ? 'detail' : initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [layerState, setLayerState] = useState<LayerState>(() => loadLayerState());
  const patchLayers = useCallback((patch: Partial<LayerState>) => {
    setLayerState(prev => {
      const next = { ...prev, ...patch };
      saveLayerState(next);
      return next;
    });
  }, []);
  const [splashDismissed, setSplashDismissed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem('plot-splash-dismissed') === '1') setSplashDismissed(true);
  }, []);
  const handleSplashDismiss = useCallback(() => {
    localStorage.setItem('plot-splash-dismissed', '1');
    setSplashDismissed(true);
  }, []);
  const [mapReady, setMapReady] = useState(false);
  const [compassBearing, setCompassBearing] = useState(0);
  const [mapResolution, setMapResolution] = useState(10);
  const [loadedActivityId, setLoadedActivityId] = useState<string | null>(null);

  // Sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Elevation chart hover → map crosshair
  const [elevationHoverPoint, setElevationHoverPoint] = useState<ElevationHoverPoint | null>(null);
  const handleElevationHover = useCallback((pt: ElevationHoverPoint | null) => setElevationHoverPoint(pt), []);

  // Planner state
  const { waypoints, segments, canUndo, canRedo, dispatch } = useRouteHistory();
  const [addPointsEnabled, setAddPointsEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const mapInstanceRef = useRef<Map | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointsRef = useRef(waypoints);
  const segmentsRef = useRef(segments);
  waypointsRef.current = waypoints;
  segmentsRef.current = segments;

  useRouteSnapping({ waypoints, segments, dispatch });
  const { elevationData, isLoading: isLoadingElevation } = useElevationProfile(waypoints, segments);

  const distance = useMemo(() => calculateDistance(waypoints, segments), [waypoints, segments]);

  const elevGain = useMemo(() => {
    if (!elevationData || elevationData.length < 2) return 0;
    let gain = 0;
    for (let i = 1; i < elevationData.length; i++) {
      const delta = elevationData[i].ele - elevationData[i - 1].ele;
      if (delta > 0) gain += delta;
    }
    return Math.round(gain);
  }, [elevationData]);

  const [mobilePlannerLayersOpen, setMobilePlannerLayersOpen] = useState(false);

  // ── Extracted hooks ───────────────────────────────────────────────────────
  const { theme, osDark, handleThemeChange } = useTheme();
  const { allActivities, isLoadingMore, hasMore, hoveredId, setHoveredId, handleLoadMore } = useActivityBrowse(activities);
  const { activityDetail, setActivityDetail, detailLoading } = useActivityDetail(selectedId);
  const { lightboxPhotos, lightboxOpen, lightboxIndex, handlePhotoClick, handleLightboxClose, handlePhotoMarkerClick } = useLightbox(activityDetail, selectedId);
  const { plannerHudHeight, setPlannerHudHeight, plannerHudDragging, handlePlannerHudTouchStart, handlePlannerHudTouchMove, handlePlannerHudTouchEnd } = usePlannerHud();
  const {
    photoPopup, setPhotoPopup,
    clusterPhotosPopup, setClusterPhotosPopup,
    activityPopup, setActivityPopup,
    popupLoading,
    hoveredActivityRoute, setHoveredActivityRoute,
    hoveredActivityColor, setHoveredActivityColor,
    handleOwnerPhotoClick, handleOwnerClusterPhotosClick, handleHeatmapClick,
  } = useMapPopups();
  const {
    waypointPopover,
    segmentTap, setSegmentTap,
    handleWaypointClick, handleSegmentTap, handleSegmentInsert,
    handleWaypointPopoverClose, handleEditWaypoint,
    handleWaypointDelete, handleToggleSnapIn, handleToggleSnapOut,
  } = useWaypointInteraction(waypoints, segments, dispatch, mapInstanceRef);

  const photosImportTriggeredRef = useRef(false);

  // Trigger photo catch-up import the first time "My photos" is enabled
  useEffect(() => {
    if (!isOwner || !layerState.showPhotos || photosImportTriggeredRef.current) return;
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
  }, [isOwner, layerState.showPhotos]);

  // Reflect panel mode in URL bar (no navigation, just history state)
  useEffect(() => {
    let path = '/';
    if (mode === 'detail' && selectedId) path = `/?activity=${selectedId}`;
    else if (mode === 'planner') path = '/planner';
    else if (mode === 'about') path = '/about';
    window.history.replaceState(null, '', path);
  }, [mode, selectedId]);

  // Load saved route on mount
  useEffect(() => {
    const stored = loadRoute();
    if (stored?.waypoints.length) {
      dispatch({ type: 'LOAD', waypoints: stored.waypoints, segments: stored.segments });
    }
  }, [dispatch]);

  // Auto-save route — only runs when map is ready to avoid persisting [0,0] center
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      const center = map.getView().getCenter() as [number, number];
      const zoom = map.getView().getZoom() ?? 7;
      saveRoute(waypointsRef.current, segmentsRef.current, center, zoom);
    }, 500);
  }, [waypoints, segments]);

  const handleResetNorth = useCallback(() => {
    mapInstanceRef.current?.getView().animate({ rotation: 0, duration: 300 });
    setCompassBearing(0);
  }, []);

  const handleMapReady = useCallback((map: Map) => {
    mapInstanceRef.current = map;
    setMapReady(true);
    // In planner mode always restore stored position (the planner fit effect will override
    // this with the route bounds if there are waypoints). In browse mode only restore when
    // there are no activities so the activity list auto-fit can take over.
    if (initialMode === 'planner' || allActivities.length === 0) {
      const stored = loadRoute();
      if (stored?.mapCenter && isValidBNG(stored.mapCenter as [number, number])) {
        map.getView().setCenter(stored.mapCenter);
        map.getView().setZoom(stored.mapZoom);
      }
    }
    // Set initial resolution
    setMapResolution(map.getView().getResolution() ?? 10);
    map.on('moveend', () => {
      const view = map.getView();
      const center = view.getCenter() as [number, number];
      const zoom = view.getZoom() ?? 7;
      if (center) saveRoute(waypointsRef.current, segmentsRef.current, center, zoom);
      setCompassBearing(view.getRotation() * 180 / Math.PI);
      setMapResolution(view.getResolution() ?? 10);
    });
  }, [allActivities.length, initialMode]);

  // On initial /planner load, fit the map to the saved route once both the map and
  // waypoints are ready. Runs once — no animation so it snaps cleanly on load.
  const initialPlannerFitDoneRef = useRef(false);
  useEffect(() => {
    if (initialPlannerFitDoneRef.current) return;
    if (initialMode !== 'planner' || !mapReady || waypoints.length < 2) return;
    initialPlannerFitDoneRef.current = true;
    const map = mapInstanceRef.current;
    if (!map) return;
    const coords = waypoints.map((wp) => fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code));
    map.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], maxZoom: 9 });
  }, [mapReady, waypoints, initialMode]);

  // When navigating directly to an activity via URL, fit the map to it once both the map
  // and the full activity detail (which always has a route) are loaded.
  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (initialFitDoneRef.current || !initialSelectedId || !mapReady || !mapInstanceRef.current) return;
    if (!activityDetail || String(activityDetail.id) !== initialSelectedId) return;
    const route = activityDetail.route;
    if (!route?.length) return;
    initialFitDoneRef.current = true;
    const coords = route.map(([lat, lng]) => fromLonLat([lng, lat], OS_PROJECTION.code));
    mapInstanceRef.current.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], maxZoom: 14 });
  // initialSelectedId is intentionally omitted from deps — it's a stable SSR prop that never
  // changes after mount. Adding it would cause a spurious re-run on every render.
  }, [mapReady, activityDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectActivity = useCallback((id: string) => {
    setSelectedId(id);
    setMode('detail');
    // Fit map to this activity's route from the already-loaded summary
    const summary = allActivities.find(a => String(a.id) === id);
    if (summary?.route?.length && mapInstanceRef.current) {
      const coords = summary.route.map(([lat, lng]) => fromLonLat([lng, lat], OS_PROJECTION.code));
      mapInstanceRef.current.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], duration: 500, maxZoom: 14 });
    }
  }, [allActivities]);

  // Mirror the initial page-load fit: 3 most recent activities sorted by startDate.
  // Avoids zooming out to include European activities that pull the extent far from the UK.
  const fitToDefaultView = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const withRoutes = allActivities.filter(a => a.route?.length);
    if (!withRoutes.length) return;
    const recent = [...withRoutes]
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
      .slice(0, 3);
    const coords = recent.flatMap(a =>
      a.route!.map(([lat, lng]) => fromLonLat([lng, lat], OS_PROJECTION.code))
    );
    if (coords.length > 1) {
      map.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], duration: 500, maxZoom: 9 });
    }
  }, [allActivities]);

  const handleBack = useCallback(() => {
    setMode('browse');
    setSelectedId(null);
    setActivityDetail(null);
    fitToDefaultView();
  }, [fitToDefaultView, setActivityDetail]);

  const handleFitToRoute = useCallback((wps: typeof waypoints) => {
    const map = mapInstanceRef.current;
    if (!map || wps.length < 2) return;
    const coords = wps.map((wp) => fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code));
    map.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], duration: 500, maxZoom: 9 });
  }, []);

  // When the user navigates browse → planner at runtime, fit the map to the route once
  // mapReady and waypoints are available — mirrors the initial-load pattern above.
  const runtimePlannerFitRef = useRef(false);
  useEffect(() => {
    if (!runtimePlannerFitRef.current || mode !== 'planner' || !mapReady || waypoints.length < 2) return;
    runtimePlannerFitRef.current = false;
    handleFitToRoute(waypoints);
  }, [mode, mapReady, waypoints, handleFitToRoute]);

  const handleOpenPlanner = useCallback(() => {
    setMode('planner');
    setSelectedId(null);
    setActivityDetail(null);
    setLoadedActivityId(null);
    runtimePlannerFitRef.current = true;
  }, [setActivityDetail]);

  const handleExitPlanner = useCallback(() => {
    setMode('browse');
    fitToDefaultView();
  }, [fitToDefaultView]);

  const handleOpenAbout = useCallback(() => setMode('about'), []);
  const handleCloseAbout = useCallback(() => setMode('browse'), []);

  const handleTabChange = useCallback((tab: 'activities' | 'planner') => {
    if (tab === 'planner') handleOpenPlanner();
    else handleExitPlanner();
  }, [handleOpenPlanner, handleExitPlanner]);

  const handleOpenInPlanner = useCallback(() => {
    if (!activityDetail?.route?.length) { handleOpenPlanner(); return; }
    if (waypoints.length > 0 && !window.confirm('Load this activity into the planner? This will replace your current route.')) return;
    const rawWaypoints = activityDetail.route.map(([lat, lng]) => ({ lat, lng }));
    // Create via-points every 2km with full track coordinates in each segment (same as GPX import)
    const { waypoints: viaPoints, segments: viaSegments } = selectGpxWaypoints(rawWaypoints, 2);
    dispatch({ type: 'LOAD', waypoints: viaPoints, segments: viaSegments });
    setLoadedActivityId(String(activityDetail.id));
    setMode('planner');
    setSelectedId(null);
    setActivityDetail(null);
    handleFitToRoute(viaPoints);
  }, [activityDetail, dispatch, handleFitToRoute, handleOpenPlanner, waypoints.length, setActivityDetail]);

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      const coord = fromLonLat([pos.coords.longitude, pos.coords.latitude], OS_PROJECTION.code);
      const rotation = computeGridNorthBearing(coord) * Math.PI / 180;
      map.getView().animate({ center: coord, zoom: 8, rotation, duration: 500 });
    });
  }, []);

  const handlePlaceSelect = useCallback((coordinates: [number, number]) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = fromLonLat(coordinates, OS_PROJECTION.code);
    const rotation = computeGridNorthBearing(center) * Math.PI / 180;
    map.getView().animate({ center, zoom: 8, rotation, duration: 500 });
  }, []);

  const handleMobileExportGpx = useCallback(() => {
    if (waypoints.length === 0) return;
    downloadGpx(waypoints, segments);
  }, [waypoints, segments]);

  const handleExportImage = useCallback(async () => {
    const map = mapInstanceRef.current;
    const view = map?.getView();
    const center27700 = view?.getCenter();
    const olZoom = view?.getZoom() ?? 7;
    const exportMode = olZoom >= 5.4 && olZoom < 6 ? 'landranger' : 'explorer';
    const wgs84Center = center27700 ? transform(center27700, 'EPSG:27700', 'EPSG:4326') : [-2.9, 54.4];
    const center: [number, number] = [wgs84Center[1], wgs84Center[0]];
    const route = segments.flatMap((s) => s.coordinates.map((c) => [c.lat, c.lng] as [number, number]));
    setIsExportingImage(true);
    try {
      const res = await fetch('/api/planner-printout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route, center, exportMode, baseMap: 'os', osDark }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'route.jpg'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      setIsExportingImage(false);
    }
  }, [segments, osDark]);

  const plannerProps: PlannerProps | undefined = mode === 'planner'
    ? { waypoints, segments, dispatch }
    : undefined;

  const activeTab = mode === 'planner' ? 'planner' : 'activities';
  const photoMarkers = mode === 'detail' ? (activityDetail?.photos ?? undefined) : undefined;

  // ── Unified layout ────────────────────────────────────────────────────────
  const sheetTitle = mode === 'detail' && activityDetail ? activityDetail.name : mode === 'about' ? 'About' : 'Activities';
  const sheetCount = mode === 'browse' && isLoggedIn ? allActivities.length : undefined;

  return (
    <div className="relative h-screen w-screen overflow-hidden sm:flex" style={{ background: 'var(--p0)' }}>

      {/* ── Desktop sidebar (hidden on mobile) ────────────────────────── */}
      <div
        className="hidden sm:flex sm:flex-col"
        style={{
          overflow: 'hidden',
          width: sidebarCollapsed ? 0 : 'var(--panel-w)',
          flexShrink: 0,
          transition: 'width 0.3s ease',
        }}
      >
        <LeftPanel
          avatarInitials={avatarInitials}
          isLoggedIn={isLoggedIn}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          theme={theme}
          onThemeChange={handleThemeChange}
          onAbout={handleOpenAbout}
        >
          {/* Keep BrowsePanel mounted to avoid remount cost and preserve scroll position */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            opacity: mode === 'browse' ? 1 : 0,
            pointerEvents: mode === 'browse' ? 'auto' : 'none',
            transition: 'opacity 0.18s ease',
          }}>
            {isLoggedIn
              ? <BrowsePanel activities={allActivities} selectedId={selectedId} onSelectActivity={handleSelectActivity} hoveredId={hoveredId} onHoverActivity={setHoveredId} hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={handleLoadMore} authError={authError} />
              : <UnauthPanel />
            }
          </div>
          {mode === 'detail' && (
            <div className="panel-fade-in" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {detailLoading || !activityDetail ? (
                <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
                  {detailLoading ? 'Loading…' : 'No data'}
                </div>
              ) : (
                <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenInPlanner} onPhotoClick={handlePhotoClick} osDark={osDark} exportBaseMap={layerState.baseLayer === 'satellite' ? 'satellite' : 'os'} exportHillshade={layerState.showHillshade} />
              )}
            </div>
          )}
          {mode === 'planner' && (
            <div className="panel-fade-in" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <PlannerPanel
                distance={distance}
                elevGain={elevGain}
                waypoints={waypoints}
                segments={segments}
                elevationData={elevationData}
                isLoadingElevation={isLoadingElevation}
                dispatch={dispatch}
                onFitToRoute={() => handleFitToRoute(waypoints)}
                onExportImage={handleExportImage}
                isExportingImage={isExportingImage}
                onEditWaypoint={handleEditWaypoint}
                onElevationHover={handleElevationHover}
              />
            </div>
          )}
          {mode === 'about' && (
            <div className="panel-fade-in" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <AboutSection onBack={handleCloseAbout} />
            </div>
          )}
        </LeftPanel>
      </div>

      {/* ── Map area ────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden sm:relative sm:inset-auto sm:flex-1">
        <SidebarToggle collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
        <MainMap
          activities={allActivities}
          highlightedId={hoveredId}
          selectedId={selectedId}
          showRecentActivities={layerState.showRecentActivities}
          onActivityHover={mode !== 'planner' ? setHoveredId : undefined}
          onPhotoMarkerClick={mode !== 'planner' ? handlePhotoMarkerClick : undefined}
          onWaypointClick={mode === 'planner' ? handleWaypointClick : undefined}
          onSegmentTap={mode === 'planner' ? handleSegmentTap : undefined}
          loadedActivityId={loadedActivityId ?? undefined}
          photoMarkers={photoMarkers}
          onActivitySelect={mode !== 'planner' ? handleSelectActivity : undefined}
          baseLayer={layerState.baseLayer}
          plannerProps={plannerProps}
          onMapReady={handleMapReady}
          osDark={osDark}
          showHillshade={layerState.showHillshade}
          dimBaseMap={layerState.dimBaseMap}
          showPersonalHeatmap={layerState.showPersonalHeatmap}
          showGlobalHeatmap={layerState.showGlobalHeatmap}
          heatmapSport={layerState.heatmapSport}
          heatmapColor={layerState.heatmapColor}
          showExplorer={layerState.showExplorer}
          showOwnerPhotos={isOwner && layerState.showPhotos}
          onPhotoClick={handleOwnerPhotoClick}
          onClusterPhotosClick={handleOwnerClusterPhotosClick}
          onHeatmapClick={isOwner ? handleHeatmapClick : undefined}
          hoveredActivityRoute={hoveredActivityRoute}
          hoveredActivityColor={hoveredActivityColor}
          onGeolocate={handleGeolocate}
          onPlaceSelect={handlePlaceSelect}
          detailRoute={activityDetail?.route ?? null}
          elevationHoverPoint={elevationHoverPoint}
        />

        {/* Desktop chrome — layers, compass, scale, legend (hidden on mobile) */}
        <div className="hidden sm:block">
          <LayersPanel state={layerState} onChange={patchLayers} bottom={16} isOwner={isOwner} theme={theme} onThemeChange={handleThemeChange} />
        </div>
        <div className="hidden sm:flex absolute bottom-[68px] left-3 z-[14] items-center gap-2">
          <Compass bearing={compassBearing} onResetNorth={handleResetNorth} />
          {mode !== 'planner' && <ScaleBar metersPerPixel={mapResolution} />}
        </div>
        {mode !== 'planner' && (
          <div className="hidden sm:block">
            <MapLegend style={{ position: 'absolute', top: 16, right: 16, zIndex: 12 }} />
          </div>
        )}

        {mode === 'planner' && (
          <PlannerToolbar
            waypoints={waypoints}
            segments={segments}
            distance={distance}
            canUndo={canUndo}
            canRedo={canRedo}
            dispatch={dispatch}
            addPointsEnabled={addPointsEnabled}
            onToggleAddPoints={() => setAddPointsEnabled((v) => !v)}
            snapEnabled={snapEnabled}
            onToggleSnap={() => setSnapEnabled((v) => !v)}
            elevationData={elevationData}
            isLoadingElevation={isLoadingElevation}
            onFitToRoute={handleFitToRoute}
            onExportImage={handleExportImage}
            isExportingImage={isExportingImage}
            onToggleLayers={() => setMobilePlannerLayersOpen(v => !v)}
            onExportGpx={handleMobileExportGpx}
          />
        )}
      </div>

      {/* ── Mobile-only chrome (hidden on desktop) ───────────────────────── */}
      <div className="sm:hidden">
        <MobileHeader
          avatarInitials={avatarInitials}
          isLoggedIn={isLoggedIn}
          theme={theme}
          onThemeChange={handleThemeChange}
          onAbout={handleOpenAbout}
          hidden={mode === 'planner'}
          style={{
            // Stay below PlannerToolbar (z-20) in planner mode so its background shows through;
            // jump to z-30 in other modes. Background is always rendered so no fade-in flash.
            zIndex: mode !== 'planner' ? 30 : 15,
            pointerEvents: mode !== 'planner' ? 'auto' : 'none',
          }}
        />

      {/* Tab bar — always shown on mobile */}
      <div style={{
        position: 'fixed', top: 60, left: 0, right: 0, height: 32,
        background: 'var(--glass-hvy)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', borderBottom: '1px solid var(--p3)', zIndex: 18,
        touchAction: 'none',
      }}>
        <button
          onClick={handleExitPlanner}
          style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '600 9px/1 var(--mono)', letterSpacing: '.14em', textTransform: 'uppercase',
            color: mode !== 'planner' ? 'var(--ora)' : 'var(--fog-dim)',
            transition: 'color 0.2s ease',
          }}
        >Activities</button>
        <button
          onClick={handleOpenPlanner}
          style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '600 9px/1 var(--mono)', letterSpacing: '.14em', textTransform: 'uppercase',
            color: mode === 'planner' ? 'var(--ora)' : 'var(--fog-dim)',
            transition: 'color 0.2s ease',
          }}
        >Planner</button>
        {/* Sliding active indicator */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: mode === 'planner' ? '50%' : '0',
          width: '50%',
          height: 2,
          background: 'var(--ora)',
          transition: 'left 0.22s ease',
          pointerEvents: 'none',
        }} />
      </div>


      {/* Map chrome — bottom-left cluster (above the buttons) */}
      <div style={{ position: 'fixed', bottom: 191, left: 12, zIndex: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Compass bearing={compassBearing} onResetNorth={handleResetNorth} />
        {mode !== 'planner' && <ScaleBar metersPerPixel={mapResolution} />}
      </div>

      {/* Conditional non-animated elements */}
      {mode !== 'planner' && (
        <>
          <LayersPanel state={layerState} onChange={patchLayers} bottom={139} fixed isOwner={isOwner} />
          <button
            onClick={handleOpenPlanner}
            style={{
              position: 'fixed',
              right: 16,
              bottom: 139,
              width: 48,
              height: 48,
              borderRadius: 6,
              background: 'var(--ora)',
              border: 'none',
              color: 'var(--p0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 18,
            }}
            aria-label="New route"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </>
      )}

      {mode === 'planner' && (
        <LayersPanel state={layerState} onChange={patchLayers} bottom={168} fixed forceOpen={mobilePlannerLayersOpen} isOwner={isOwner} theme={theme} onThemeChange={handleThemeChange} />
      )}

      {/* Activities bottom sheet — always mounted, crossfades out when entering planner */}
      <MobileBottomSheet
        title={sheetTitle}
        count={sheetCount}
        forceExpanded={mode === 'detail' || mode === 'about'}
        style={{
          opacity: mode !== 'planner' ? 1 : 0,
          pointerEvents: mode !== 'planner' ? 'auto' : 'none',
          transform: mode !== 'planner' ? 'translateY(0)' : 'translateY(100%)',
          transition: 'opacity 0.28s ease, transform 0.28s ease',
        }}
      >
        {/* Keep BrowsePanel mounted to avoid remount cost and preserve scroll position */}
        <div style={{ display: mode === 'browse' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {isLoggedIn
            ? <BrowsePanel activities={allActivities} selectedId={selectedId} onSelectActivity={handleSelectActivity} hoveredId={hoveredId} onHoverActivity={setHoveredId} hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={handleLoadMore} authError={authError} />
            : <UnauthPanel />
          }
        </div>
        {mode === 'detail' && (
          detailLoading || !activityDetail ? (
            <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
              {detailLoading ? 'Loading…' : 'No data'}
            </div>
          ) : (
            <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenInPlanner} onPhotoClick={handlePhotoClick} osDark={osDark} exportBaseMap={layerState.baseLayer === 'satellite' ? 'satellite' : 'os'} exportHillshade={layerState.showHillshade} />
          )
        )}
        {mode === 'about' && (
          <AboutSection onBack={handleCloseAbout} />
        )}
      </MobileBottomSheet>

      {/* Planner HUD — always mounted, crossfades in when entering planner */}
      {(() => {
        const pts = elevationData ?? [];
        const totalD = pts.length > 1 ? pts[pts.length - 1].distance : 0;
        const W = 358; const H = 34;
        let sparklinePts = '';
        let fillPath = '';
        if (pts.length >= 2) {
          const eles = pts.map(p => p.ele);
          const minE = Math.min(...eles);
          const maxE = Math.max(...eles);
          const rangeE = maxE - minE || 1;
          const toX = (d: number) => totalD ? (d / totalD) * W : 0;
          const toY = (e: number) => H - 2 - ((e - minE) / rangeE) * (H - 4);
          sparklinePts = pts.map(p => `${toX(p.distance).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ');
          fillPath = `M0,${H} L${sparklinePts.split(' ').join(' L')} L${W},${H} Z`;
        }
        const distKm = (distance / 1000).toFixed(1);
        return (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            height: plannerHudHeight,
            background: 'var(--p1)',
            borderTop: '1px solid var(--p3)', borderRadius: '16px 16px 0 0',
            zIndex: 20,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            touchAction: 'none',
            opacity: mode === 'planner' ? 1 : 0,
            pointerEvents: mode === 'planner' ? 'auto' : 'none',
            transform: mode === 'planner' ? 'translateY(0)' : 'translateY(100%)',
            transition: plannerHudDragging ? 'none' : 'height 0.3s ease, opacity 0.28s ease, transform 0.28s ease',
          }}>
                {/* Drag zone — handle bar + stats row, large touch target */}
                <div
                  onTouchStart={handlePlannerHudTouchStart}
                  onTouchMove={handlePlannerHudTouchMove}
                  onTouchEnd={handlePlannerHudTouchEnd}
                  onClick={() => setPlannerHudHeight(h => h > PLANNER_HUD_COLLAPSED + 5 ? PLANNER_HUD_COLLAPSED : PLANNER_HUD_EXPANDED)}
                  style={{ flexShrink: 0, userSelect: 'none', cursor: 'grab' }}
                >
                  <div style={{ padding: '10px 0 6px' }}>
                    <div style={{ width: 36, height: 4, background: 'var(--p4)', borderRadius: 2, margin: '0 auto' }} />
                  </div>
                  {/* Stats inside drag zone so swiping on them also works */}
                  <div style={{ display: 'flex', padding: '0 20px 14px' }}>
                    {[
                      { val: distKm, lbl: 'km' },
                      { val: elevGain > 0 ? String(elevGain) : '—', lbl: 'm elev' },
                      { val: String(waypoints.length), lbl: 'waypts' },
                    ].map((s, i, arr) => (
                      <div key={s.lbl} style={{
                        flex: 1, display: 'flex', flexDirection: 'column', gap: 3,
                        borderRight: i < arr.length - 1 ? '1px solid var(--fog-ghost)' : 'none',
                        paddingRight: i < arr.length - 1 ? 16 : 0,
                        paddingLeft: i > 0 ? 16 : 0,
                      }}>
                        <div style={{ font: '700 18px/1 var(--mono)', color: 'var(--ora)' }}>{s.val}</div>
                        <div style={{ font: '400 8px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fog-dim)' }}>{s.lbl}</div>
                      </div>
                    ))}
                  </div>
                </div>{/* end drag zone */}
                <div style={{ position: 'relative', padding: '0 16px 10px' }}>
                  <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="mhud-elev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E07020" stopOpacity="0.30" />
                        <stop offset="100%" stopColor="#E07020" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {fillPath && <path d={fillPath} fill="url(#mhud-elev)" />}
                    {sparklinePts && <polyline points={sparklinePts} fill="none" stroke="#E07020" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                  </svg>
                  <div style={{ position: 'absolute', bottom: 13, left: 18, font: '400 7px/1 var(--mono)', color: 'var(--fog-dim)' }}>0</div>
                  <div style={{ position: 'absolute', bottom: 13, right: 18, font: '400 7px/1 var(--mono)', color: 'var(--fog-dim)' }}>{distKm}km</div>
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '0 16px 14px' }}>
                  <button
                    onClick={() => setMobilePlannerLayersOpen(v => !v)}
                    style={{ flex: 1, height: 40, borderRadius: 4, border: 'none', background: 'var(--p3)', color: 'var(--fog)', font: '700 10px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                    </svg>
                    Layers
                  </button>
                  <button
                    onClick={handleMobileExportGpx}
                    disabled={waypoints.length === 0}
                    style={{ flex: 1, height: 40, borderRadius: 4, border: 'none', background: waypoints.length === 0 ? 'var(--p3)' : 'var(--ora)', color: waypoints.length === 0 ? 'var(--fog-dim)' : 'var(--p0)', font: '700 10px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export GPX
                  </button>
                </div>
          </div>
          );
        })()}
      </div>{/* end sm:hidden mobile chrome */}

      {/* ── Shared overlays ──────────────────────────────────────────────── */}
      {segmentTap && mode === 'planner' && (
        <>
          <div onClick={() => setSegmentTap(null)} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
          <div style={{
            position: 'fixed',
            left: segmentTap.screenX,
            top: segmentTap.screenY,
            transform: 'translateX(-50%) translateY(calc(-100% - 12px))',
            width: 200,
            background: 'var(--p1)',
            border: '1px solid var(--p3)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            padding: 10,
            zIndex: 40,
          }}>
            {/* Header + X */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ice)', fontFamily: 'var(--mono)' }}>
                Insert waypoint
              </div>
              <button
                onClick={() => setSegmentTap(null)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--fog-dim)', lineHeight: 1 }}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
            <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 8 }} />
            <button
              onClick={handleSegmentInsert}
              style={{
                width: '100%', padding: '6px 8px',
                background: 'var(--p2)', border: '1px solid var(--fog-ghost)', borderRadius: 4,
                color: 'var(--ice)', fontFamily: 'var(--mono)', fontSize: 10,
                fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
              }}
            >
              Insert here
            </button>
          </div>
        </>
      )}
      {waypointPopover && mode === 'planner' && waypoints[waypointPopover.index] && (
        <WaypointPopover
          waypoint={waypoints[waypointPopover.index]}
          index={waypointPopover.index}
          totalWaypoints={waypoints.length}
          segments={segments}
          screenX={waypointPopover.screenX}
          screenY={waypointPopover.screenY}
          onClose={handleWaypointPopoverClose}
          onDelete={handleWaypointDelete}
          onToggleSnapIn={handleToggleSnapIn}
          onToggleSnapOut={handleToggleSnapOut}
        />
      )}
      {lightboxOpen && (
        <PhotoLightbox photos={lightboxPhotos} initialIndex={lightboxIndex} onClose={handleLightboxClose} />
      )}
      {photoPopup && (
        <PhotoPopup
          photo={photoPopup.photo}
          screenX={photoPopup.screenX}
          screenY={photoPopup.screenY}
          onClose={() => { setPhotoPopup(null); setHoveredActivityRoute(null); }}
        />
      )}
      {clusterPhotosPopup && (
        <ClusterPhotosPopup
          photos={clusterPhotosPopup.photos}
          screenX={clusterPhotosPopup.screenX}
          screenY={clusterPhotosPopup.screenY}
          onClose={() => { setClusterPhotosPopup(null); setHoveredActivityRoute(null); }}
          onPhotoSelect={(photo, sx, sy) => {
            setClusterPhotosPopup(null);
            handleOwnerPhotoClick(photo, sx, sy);
          }}
        />
      )}
      {activityPopup && (
        <HeatmapActivityPopup
          activities={activityPopup.activities}
          screenX={activityPopup.screenX}
          screenY={activityPopup.screenY}
          isLoading={popupLoading}
          onClose={() => { setActivityPopup(null); setHoveredActivityRoute(null); setHoveredActivityColor(null); }}
          onHoverActivity={(route, color) => { setHoveredActivityRoute(route ?? null); setHoveredActivityColor(color ?? null); }}
        />
      )}
      {!isLoggedIn && !splashDismissed && (
        <SplashOverlay onDismiss={handleSplashDismiss} onPlanRoute={() => { handleSplashDismiss(); handleOpenPlanner(); }} />
      )}
    </div>
  );
}
