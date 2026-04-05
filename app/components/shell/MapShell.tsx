'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Map from 'ol/Map';
import { fromLonLat, transform } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
import { ActivitySummary, ActivityData } from '@/lib/types';
import { type MapLayer, type PlannerProps } from '@/app/components/MainMap';
import { useRouteHistory } from '@/app/(main)/planner/useRouteHistory';
import { useRouteSnapping } from '@/app/(main)/planner/useRouteSnapping';
import { useElevationProfile } from '@/app/(main)/planner/useElevationProfile';
import { calculateDistance } from '@/app/(main)/planner/route-utils';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { OS_PROJECTION } from '@/lib/map-config';
import { type Theme, loadTheme, saveTheme, applyThemeToDocument } from '@/lib/theme';
import LeftPanel from './LeftPanel';
import BrowsePanel from './BrowsePanel';
import DetailPanel from './DetailPanel';
import PlannerPanel from './PlannerPanel';
import UnauthPanel from './UnauthPanel';
import MobileHeader from './MobileHeader';
import MobileLegend from './MobileLegend';
import MobileBottomSheet from './MobileBottomSheet';
import PlannerToolbar from '@/app/(main)/planner/PlannerToolbar';

const MainMap = dynamic(() => import('@/app/components/MainMap'), { ssr: false });

export type PanelMode = 'browse' | 'detail' | 'planner';

function LayerToggle({ baseLayer, onBaseLayerChange, bottom, fixed }: {
  baseLayer: MapLayer;
  onBaseLayerChange: (l: MapLayer) => void;
  bottom: number;
  fixed?: boolean;
}) {
  return (
    <div style={{
      position: fixed ? 'fixed' : 'absolute',
      bottom,
      right: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      zIndex: 15,
    }}>
      {(['topo', 'satellite'] as MapLayer[]).map((l) => (
        <button
          key={l}
          onClick={() => onBaseLayerChange(l)}
          title={l === 'topo' ? 'Topo' : 'Satellite'}
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            border: `1px solid ${baseLayer === l ? 'var(--ora)' : 'var(--p3)'}`,
            background: baseLayer === l ? 'rgba(224,112,32,0.18)' : 'rgba(7,14,20,0.75)',
            color: baseLayer === l ? 'var(--ora)' : 'var(--fog-dim)',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          {l === 'topo' ? 'T' : 'S'}
        </button>
      ))}
    </div>
  );
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
  initialMode?: PanelMode;
}

export default function MapShell({ activities, avatarInitials, isLoggedIn = false, initialMode = 'browse' }: MapShellProps) {
  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityDetail, setActivityDetail] = useState<ActivityData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [baseLayer, setBaseLayer] = useState<MapLayer>('topo');
  const [isMobile, setIsMobile] = useState(false);

  // Theme
  const [theme, setTheme] = useState<Theme>('system');
  const [sysDark, setSysDark] = useState(false);
  const osDark = theme === 'dark' || (theme === 'system' && sysDark);

  // Planner state
  const { waypoints, segments, canUndo, canRedo, dispatch } = useRouteHistory();
  const [addPointsEnabled, setAddPointsEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [hoveredElevationPoint, setHoveredElevationPoint] = useState<{ lat: number; lng: number; ele: number; distance: number } | null>(null);
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
    return gain;
  }, [elevationData]);

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Theme initialisation + system preference tracking
  useEffect(() => {
    const stored = loadTheme();
    const sysMq = window.matchMedia('(prefers-color-scheme: dark)');
    const dark = sysMq.matches;
    setSysDark(dark);
    setTheme(stored);
    const handler = (e: MediaQueryListEvent) => setSysDark(e.matches);
    sysMq.addEventListener('change', handler);
    return () => sysMq.removeEventListener('change', handler);
  }, []);

  // Apply theme to document whenever theme or sysDark changes
  useEffect(() => {
    applyThemeToDocument(theme, sysDark);
  }, [theme, sysDark]);

  const handleThemeChange = useCallback((t: Theme) => {
    setTheme(t);
    saveTheme(t);
  }, []);

  // Fetch activity detail
  useEffect(() => {
    if (!selectedId) { setActivityDetail(null); return; }
    setDetailLoading(true);
    fetch(`/api/activities/${selectedId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: ActivityData) => { setActivityDetail(data); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedId]);

  // Load saved route on mount
  useEffect(() => {
    const stored = loadRoute();
    if (stored?.waypoints.length) {
      dispatch({ type: 'LOAD', waypoints: stored.waypoints, segments: stored.segments });
    }
  }, [dispatch]);

  // Auto-save route
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const map = mapInstanceRef.current;
      const center = map ? (map.getView().getCenter() as [number, number]) : [0, 0] as [number, number];
      const zoom = map?.getView().getZoom() ?? 7;
      saveRoute(waypointsRef.current, segmentsRef.current, center, zoom);
    }, 500);
  }, [waypoints, segments]);

  const handleMapReady = useCallback((map: Map) => {
    mapInstanceRef.current = map;
    const stored = loadRoute();
    if (stored?.mapCenter[0] !== 0) {
      map.getView().setCenter(stored!.mapCenter);
      map.getView().setZoom(stored!.mapZoom);
    }
    map.on('moveend', () => {
      const view = map.getView();
      const center = view.getCenter() as [number, number];
      const zoom = view.getZoom() ?? 7;
      if (center) saveRoute(waypointsRef.current, segmentsRef.current, center, zoom);
    });
  }, []);

  const handleSelectActivity = useCallback((id: string) => {
    setSelectedId(id);
    setMode('detail');
  }, []);

  const handleBack = useCallback(() => {
    setMode('browse');
    setSelectedId(null);
    setActivityDetail(null);
  }, []);

  const handleOpenPlanner = useCallback(() => {
    setMode('planner');
    setSelectedId(null);
    setActivityDetail(null);
  }, []);

  const handleExitPlanner = useCallback(() => setMode('browse'), []);

  const handleTabChange = useCallback((tab: 'activities' | 'planner') => {
    if (tab === 'planner') handleOpenPlanner();
    else handleExitPlanner();
  }, [handleOpenPlanner, handleExitPlanner]);

  const handleFitToRoute = useCallback((wps: typeof waypoints) => {
    const map = mapInstanceRef.current;
    if (!map || wps.length < 2) return;
    const coords = wps.map((wp) => fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code));
    map.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], duration: 500, maxZoom: 9 });
  }, []);

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
        body: JSON.stringify({ route, center, exportMode, baseMap: 'os', osDark: true }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'route.jpg'; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingImage(false);
    }
  }, [segments]);

  const plannerProps: PlannerProps | undefined = mode === 'planner'
    ? { waypoints, segments, dispatch }
    : undefined;

  const activeTab = mode === 'planner' ? 'planner' : 'activities';
  const photoMarkers = activityDetail?.photos ?? undefined;

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--p0)' }}>
        <LeftPanel
          avatarInitials={avatarInitials}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          theme={theme}
          onThemeChange={handleThemeChange}
        >
          {mode === 'browse' && (
            isLoggedIn
              ? <BrowsePanel activities={activities} selectedId={selectedId} onSelectActivity={handleSelectActivity} />
              : <UnauthPanel />
          )}
          {mode === 'detail' && (
            detailLoading || !activityDetail ? (
              <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
                {detailLoading ? 'Loading…' : 'No data'}
              </div>
            ) : (
              <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenPlanner} />
            )
          )}
          {mode === 'planner' && (
            <PlannerPanel distance={distance} elevGain={elevGain} />
          )}
        </LeftPanel>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <MainMap
            activities={activities}
            highlightedId={selectedId}
            photoMarkers={photoMarkers}
            onActivitySelect={mode !== 'planner' ? handleSelectActivity : undefined}
            baseLayer={baseLayer}
            onBaseLayerChange={setBaseLayer}
            plannerProps={plannerProps}
            onMapReady={handleMapReady}
            osDark={osDark}
          />
          {mode !== 'planner' && (
            <LayerToggle baseLayer={baseLayer} onBaseLayerChange={setBaseLayer} bottom={16} />
          )}
          {mode === 'planner' && (
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
              onBack={handleExitPlanner}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  const sheetTitle = mode === 'detail' && activityDetail ? activityDetail.name : 'Activities';
  const sheetCount = mode === 'browse' && isLoggedIn ? activities.length : undefined;

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--p0)' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <MainMap
          activities={activities}
          highlightedId={selectedId}
          photoMarkers={photoMarkers}
          onActivitySelect={mode !== 'planner' ? handleSelectActivity : undefined}
          baseLayer={baseLayer}
          onBaseLayerChange={setBaseLayer}
          plannerProps={plannerProps}
          onMapReady={handleMapReady}
          osDark={osDark}
        />
      </div>

      <MobileHeader avatarInitials={avatarInitials} theme={theme} onThemeChange={handleThemeChange} />
      <MobileLegend />

      {mode !== 'planner' && (
        <>
          <LayerToggle baseLayer={baseLayer} onBaseLayerChange={setBaseLayer} bottom={198} fixed />
          <button
            onClick={handleOpenPlanner}
            style={{
              position: 'fixed',
              right: 16,
              bottom: 142,
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
          <MobileBottomSheet
            title={sheetTitle}
            count={sheetCount}
            forceExpanded={mode === 'detail'}
          >
            {mode === 'browse' && (
              isLoggedIn
                ? <BrowsePanel activities={activities} selectedId={selectedId} onSelectActivity={handleSelectActivity} />
                : <UnauthPanel />
            )}
            {mode === 'detail' && (
              detailLoading || !activityDetail ? (
                <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
                  {detailLoading ? 'Loading…' : 'No data'}
                </div>
              ) : (
                <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenPlanner} />
              )
            )}
          </MobileBottomSheet>
        </>
      )}

      {mode === 'planner' && (
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
          onBack={handleExitPlanner}
        />
      )}
    </div>
  );
}
