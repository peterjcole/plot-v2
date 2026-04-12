'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Map from 'ol/Map';
import { fromLonLat, transform } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
import { ActivitySummary, ActivityData, ActivityPhoto, PhotoItem, HeatmapActivity } from '@/lib/types';
import { type MapLayer, type PlannerProps, type WaypointClickInfo } from '@/app/components/MainMap';
import LayersPanel, { type LayerState, loadLayerState, saveLayerState } from './LayersPanel';
import { useRouteHistory } from '@/app/(main)/planner/useRouteHistory';
import { useRouteSnapping } from '@/app/(main)/planner/useRouteSnapping';
import { useElevationProfile } from '@/app/(main)/planner/useElevationProfile';
import { calculateDistance } from '@/app/(main)/planner/route-utils';
import { saveRoute, loadRoute } from '@/lib/route-storage';
import { selectGpxWaypoints, downloadGpx } from '@/lib/gpx';
import { OS_PROJECTION } from '@/lib/map-config';
import { type Theme, loadTheme, saveTheme, applyThemeToDocument } from '@/lib/theme';
import LeftPanel from './LeftPanel';
import BrowsePanel from './BrowsePanel';
import DetailPanel from './DetailPanel';
import PlannerPanel from './PlannerPanel';
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
import PhotoPopup from '@/app/(main)/planner/PhotoPopup';
import ClusterPhotosPopup from '@/app/(main)/planner/ClusterPhotosPopup';
import HeatmapActivityPopup from '@/app/(main)/planner/HeatmapActivityPopup';

const MainMap = dynamic(() => import('@/app/components/MainMap'), { ssr: false });

export type PanelMode = 'browse' | 'detail' | 'planner' | 'about';


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
  const [activityDetail, setActivityDetail] = useState<ActivityData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [layerState, setLayerState] = useState<LayerState>(() => loadLayerState());
  const patchLayers = useCallback((patch: Partial<LayerState>) => {
    setLayerState(prev => {
      const next = { ...prev, ...patch };
      saveLayerState(next);
      return next;
    });
  }, []);
  const [isMobile, setIsMobile] = useState(false);
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loadedActivityId, setLoadedActivityId] = useState<string | null>(null);

  // Lightbox — index of -1 means closed
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const lightboxPhotos = activityDetail?.photos ?? [];
  const handlePhotoClick = useCallback((index: number) => setLightboxIndex(index), []);
  const handleLightboxClose = useCallback(() => setLightboxIndex(-1), []);
  const handlePhotoMarkerClick = useCallback((photoId: string) => {
    const idx = lightboxPhotos.findIndex(p => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  }, [lightboxPhotos]);
  const lightboxOpen = lightboxIndex >= 0 && lightboxPhotos.length > 0;

  // Reset lightbox when activity changes
  useEffect(() => { setLightboxIndex(-1); }, [selectedId]);

  // Pagination
  const [allActivities, setAllActivities] = useState(activities);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(activities.length === 50);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const next = await fetch(`/api/activities?page=${page + 1}&perPage=50`).then(r => r.json()) as typeof activities;
      setAllActivities(prev => [...prev, ...next]);
      setPage(p => p + 1);
      setHasMore(next.length === 50);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page]);

  // Theme
  const [theme, setTheme] = useState<Theme>('system');
  const [sysDark, setSysDark] = useState(false);
  const osDark = theme === 'dark' || (theme === 'system' && sysDark);

  // Owner photo popups
  const [photoPopup, setPhotoPopup] = useState<{ photo: PhotoItem; screenX: number; screenY: number } | null>(null);
  const [clusterPhotosPopup, setClusterPhotosPopup] = useState<{ photos: PhotoItem[]; screenX: number; screenY: number } | null>(null);
  const photosImportTriggeredRef = useRef(false);

  // Heatmap activity popup + route highlight
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
    return Math.round(gain);
  }, [elevationData]);

  const [mobilePlannerLayersOpen, setMobilePlannerLayersOpen] = useState(false);

  // Mobile planner HUD — draggable bottom panel
  // COLLAPSED = thin grab strip, map almost fully visible; EXPANDED = natural content height
  const PLANNER_HUD_COLLAPSED = 38;
  const PLANNER_HUD_EXPANDED = 158;
  const [plannerHudHeight, setPlannerHudHeight] = useState(PLANNER_HUD_EXPANDED);
  const [plannerHudDragging, setPlannerHudDragging] = useState(false);
  const plannerHudDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const handlePlannerHudTouchStart = useCallback((e: React.TouchEvent) => {
    plannerHudDragRef.current = { startY: e.touches[0].clientY, startH: plannerHudHeight };
    setPlannerHudDragging(true);
  }, [plannerHudHeight]);
  const handlePlannerHudTouchMove = useCallback((e: React.TouchEvent) => {
    if (!plannerHudDragRef.current) return;
    const delta = plannerHudDragRef.current.startY - e.touches[0].clientY;
    // Allow drag from collapsed up to expanded; clamp between collapsed and expanded
    const next = Math.max(PLANNER_HUD_COLLAPSED, Math.min(PLANNER_HUD_EXPANDED, plannerHudDragRef.current.startH + delta));
    setPlannerHudHeight(next);
  }, []);
  const handlePlannerHudTouchEnd = useCallback(() => {
    if (!plannerHudDragRef.current) return;
    setPlannerHudDragging(false);
    // Snap: if dragged past halfway, collapse; otherwise expand
    const mid = (PLANNER_HUD_COLLAPSED + PLANNER_HUD_EXPANDED) / 2;
    setPlannerHudHeight(h => h >= mid ? PLANNER_HUD_EXPANDED : PLANNER_HUD_COLLAPSED);
    plannerHudDragRef.current = null;
  }, []);

  const handleMobileExportGpx = useCallback(() => {
    if (waypoints.length === 0) return;
    downloadGpx(waypoints, segments);
  }, [waypoints, segments]);

  // Waypoint popover
  const [waypointPopover, setWaypointPopover] = useState<WaypointClickInfo | null>(null);
  const handleWaypointClick = useCallback((info: WaypointClickInfo) => setWaypointPopover(info), []);
  const handleWaypointPopoverClose = useCallback(() => setWaypointPopover(null), []);
  const handleEditWaypoint = useCallback((index: number) => {
    const wp = waypointsRef.current[index];
    const map = mapInstanceRef.current;
    if (!wp || !map) return;
    const coord = fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code);

    const showPopover = () => {
      const px = map.getPixelFromCoordinate(coord);
      if (!px) return;
      const rect = map.getTargetElement().getBoundingClientRect();
      setWaypointPopover({ index, screenX: rect.left + px[0], screenY: rect.top + px[1] });
    };

    const size = map.getSize();
    const pixel = map.getPixelFromCoordinate(coord);
    const offscreen = !pixel || !size ||
      pixel[0] < 0 || pixel[1] < 0 || pixel[0] > size[0] || pixel[1] > size[1];

    if (offscreen) {
      map.getView().animate({ center: coord, duration: 300 }, showPopover);
    } else {
      showPopover();
    }
  }, []);
  const handleWaypointDelete = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_WAYPOINT', index });
    setWaypointPopover(null);
  }, [dispatch]);
  const handleToggleSnapIn = useCallback((index: number) => {
    if (index > 0) dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index: index - 1 });
  }, [dispatch]);
  const handleToggleSnapOut = useCallback((index: number) => {
    if (index < segments.length) dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index });
  }, [dispatch, segments.length]);


  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  // Reflect panel mode in URL bar (no navigation, just history state)
  useEffect(() => {
    let path = '/';
    if (mode === 'detail' && selectedId) path = `/?activity=${selectedId}`;
    else if (mode === 'planner') path = '/planner';
    else if (mode === 'about') path = '/about';
    window.history.replaceState(null, '', path);
  }, [mode, selectedId]);

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

  // Real GB BNG coordinates are x ∈ [60000, 700000], y ∈ [10000, 1250000].
  // WGS84 lon/lat values for GB (e.g. [8.7, 50.1] for Frankfurt) are tiny by comparison
  // and must be rejected to avoid a stale/wrong-format center being applied.
  function isValidBNG([x, y]: [number, number]) {
    return x > 60000 && x < 700000 && y > 10000 && y < 1250000;
  }

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
  }, [allActivities.length, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [mapReady, waypoints, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleBack = useCallback(() => {
    setMode('browse');
    setSelectedId(null);
    setActivityDetail(null);
  }, []);

  const handleFitToRoute = useCallback((wps: typeof waypoints) => {
    const map = mapInstanceRef.current;
    if (!map || wps.length < 2) return;
    const coords = wps.map((wp) => fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code));
    map.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], duration: 500, maxZoom: 9 });
  }, []);

  const handleOpenPlanner = useCallback(() => {
    setMode('planner');
    setSelectedId(null);
    setActivityDetail(null);
    setLoadedActivityId(null);
    // Defer until after mode change re-renders
    setTimeout(() => handleFitToRoute(waypoints), 50);
  }, [waypoints, handleFitToRoute]);

  const handleExitPlanner = useCallback(() => setMode('browse'), []);

  const handleOpenAbout = useCallback(() => setMode('about'), []);
  const handleCloseAbout = useCallback(() => setMode('browse'), []);

  const handleOwnerPhotoClick = useCallback(async (photo: PhotoItem, screenX: number, screenY: number) => {
    setActivityPopup(null);
    setClusterPhotosPopup(null);
    setHoveredActivityRoute(null);
    setPhotoPopup({ photo, screenX, screenY });
    try {
      const res = await fetch(`/api/tiles/activities?lat=${photo.lat}&lng=${photo.lng}`);
      if (res.ok) {
        const data = await res.json() as { id: number; route: [number, number][] }[];
        const match = data.find(a => a.id === photo.activityId) ?? data[0];
        if (match) { setHoveredActivityRoute(match.route); setHoveredActivityColor(null); }
      }
    } catch { /* ignore */ }
  }, []);

  const handleOwnerClusterPhotosClick = useCallback((photos: PhotoItem[], screenX: number, screenY: number) => {
    setActivityPopup(null);
    setPhotoPopup(null);
    setHoveredActivityRoute(null);
    setClusterPhotosPopup({ photos, screenX, screenY });
  }, []);

  const handleHeatmapClick = useCallback(async (lat: number, lng: number, screenX: number, screenY: number) => {
    // Same point → toggle close
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
        setActivityPopup(prev => prev ? { ...prev, activities: data } : null);
      } else {
        setActivityPopup(null);
      }
    } catch {
      setActivityPopup(null);
    } finally {
      setPopupLoading(false);
    }
  }, [activityPopup]);

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
  }, [activityDetail, dispatch, handleFitToRoute, handleOpenPlanner, waypoints.length]);

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
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingImage(false);
    }
  }, [segments]);

  const plannerProps: PlannerProps | undefined = mode === 'planner'
    ? { waypoints, segments, dispatch }
    : undefined;

  const activeTab = mode === 'planner' ? 'planner' : 'activities';
  const photoMarkers = mode === 'detail' ? (activityDetail?.photos ?? undefined) : undefined;

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--p0)' }}>
        <LeftPanel
          avatarInitials={avatarInitials}
          isLoggedIn={isLoggedIn}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          theme={theme}
          onThemeChange={handleThemeChange}
          onAbout={handleOpenAbout}
        >
          {mode === 'browse' && (
            isLoggedIn
              ? <BrowsePanel activities={allActivities} selectedId={selectedId} onSelectActivity={handleSelectActivity} hoveredId={hoveredId} onHoverActivity={setHoveredId} hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={handleLoadMore} authError={authError} />
              : <UnauthPanel />
          )}
          {mode === 'detail' && (
            detailLoading || !activityDetail ? (
              <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
                {detailLoading ? 'Loading…' : 'No data'}
              </div>
            ) : (
              <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenInPlanner} onPhotoClick={handlePhotoClick} osDark={osDark} />
            )
          )}
          {mode === 'planner' && (
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
            />
          )}
          {mode === 'about' && (
            <AboutSection onBack={handleCloseAbout} />
          )}
        </LeftPanel>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <MainMap
            activities={allActivities}
            highlightedId={hoveredId}
            selectedId={selectedId}
            showRecentActivities={layerState.showRecentActivities}
            onActivityHover={mode !== 'planner' ? setHoveredId : undefined}
            onPhotoMarkerClick={mode !== 'planner' ? handlePhotoMarkerClick : undefined}
            onWaypointClick={mode === 'planner' ? handleWaypointClick : undefined}
            loadedActivityId={loadedActivityId ?? undefined}
            photoMarkers={photoMarkers}
            onActivitySelect={mode !== 'planner' ? handleSelectActivity : undefined}
            baseLayer={layerState.baseLayer}
            plannerProps={plannerProps}
            onMapReady={handleMapReady}
            osDark={osDark}
            showHillshade={layerState.showHillshade}
            showPhotos={mode === 'detail' ? true : layerState.showPhotos}
            dimBaseMap={layerState.dimBaseMap}
            showPersonalHeatmap={layerState.showPersonalHeatmap}
            showGlobalHeatmap={layerState.showGlobalHeatmap}
            heatmapSport={layerState.heatmapSport}
            heatmapColor={layerState.heatmapColor}
            showExplorer={layerState.showExplorer}
            showPOIs={layerState.showPOIs}
            showOwnerPhotos={isOwner && layerState.showPhotos}
            onPhotoClick={handleOwnerPhotoClick}
            onClusterPhotosClick={handleOwnerClusterPhotosClick}
            onHeatmapClick={isOwner ? handleHeatmapClick : undefined}
            hoveredActivityRoute={hoveredActivityRoute}
            hoveredActivityColor={hoveredActivityColor}
            onGeolocate={handleGeolocate}
            onPlaceSelect={handlePlaceSelect}
          />
          {/* Map chrome — bottom-left cluster */}
          <LayersPanel state={layerState} onChange={patchLayers} bottom={16} isOwner={isOwner} />
          <div style={{ position: 'absolute', bottom: 68, left: 12, zIndex: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Compass bearing={compassBearing} onResetNorth={handleResetNorth} />
            {mode !== 'planner' && <ScaleBar metersPerPixel={mapResolution} />}
          </div>
          {/* Activity legend — top-right */}
          {mode !== 'planner' && (
            <MapLegend style={{ position: 'absolute', top: 16, right: 16, zIndex: 12 }} />
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

  // ── Mobile layout ──────────────────────────────────────────────────────────
  const sheetTitle = mode === 'detail' && activityDetail ? activityDetail.name : mode === 'about' ? 'About' : 'Activities';
  const sheetCount = mode === 'browse' && isLoggedIn ? allActivities.length : undefined;

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--p0)' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <MainMap
          activities={allActivities}
          highlightedId={undefined}
          selectedId={selectedId}
          showRecentActivities={layerState.showRecentActivities}
          photoMarkers={photoMarkers}
          onActivitySelect={mode !== 'planner' ? handleSelectActivity : undefined}
          onWaypointClick={mode === 'planner' ? handleWaypointClick : undefined}
          baseLayer={layerState.baseLayer}
          plannerProps={plannerProps}
          onMapReady={handleMapReady}
          osDark={osDark}
          showHillshade={layerState.showHillshade}
          showPhotos={mode === 'detail' ? true : layerState.showPhotos}
          dimBaseMap={layerState.dimBaseMap}
          showPersonalHeatmap={layerState.showPersonalHeatmap}
          showGlobalHeatmap={layerState.showGlobalHeatmap}
          heatmapSport={layerState.heatmapSport}
          heatmapColor={layerState.heatmapColor}
          showExplorer={layerState.showExplorer}
          showPOIs={layerState.showPOIs}
          showOwnerPhotos={isOwner && layerState.showPhotos}
          onPhotoClick={handleOwnerPhotoClick}
          onClusterPhotosClick={handleOwnerClusterPhotosClick}
          onHeatmapClick={isOwner ? handleHeatmapClick : undefined}
          hoveredActivityRoute={hoveredActivityRoute}
          hoveredActivityColor={hoveredActivityColor}
          onGeolocate={handleGeolocate}
          onPlaceSelect={handlePlaceSelect}
          isMobile
        />
      </div>

      {mode !== 'planner' && <MobileHeader avatarInitials={avatarInitials} isLoggedIn={isLoggedIn} theme={theme} onThemeChange={handleThemeChange} onAbout={handleOpenAbout} />}

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
            borderBottom: mode !== 'planner' ? '2px solid var(--ora)' : '2px solid transparent',
          }}
        >Activities</button>
        <button
          onClick={handleOpenPlanner}
          style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '600 9px/1 var(--mono)', letterSpacing: '.14em', textTransform: 'uppercase',
            color: mode === 'planner' ? 'var(--ora)' : 'var(--fog-dim)',
            borderBottom: mode === 'planner' ? '2px solid var(--ora)' : '2px solid transparent',
          }}
        >Planner</button>
      </div>


      {/* Map chrome — bottom-left cluster (above the buttons) */}
      <div style={{ position: 'fixed', bottom: 220, left: 12, zIndex: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Compass bearing={compassBearing} onResetNorth={handleResetNorth} />
        {mode !== 'planner' && <ScaleBar metersPerPixel={mapResolution} />}
      </div>

      {mode !== 'planner' && (
        <>
          <LayersPanel state={layerState} onChange={patchLayers} bottom={168} fixed isOwner={isOwner} />
          <button
            onClick={handleOpenPlanner}
            style={{
              position: 'fixed',
              right: 16,
              bottom: 168,
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
            forceExpanded={mode === 'detail' || mode === 'about'}
          >
            {mode === 'browse' && (
              isLoggedIn
                ? <BrowsePanel activities={allActivities} selectedId={selectedId} onSelectActivity={handleSelectActivity} hoveredId={hoveredId} onHoverActivity={setHoveredId} hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={handleLoadMore} authError={authError} />
                : <UnauthPanel />
            )}
            {mode === 'detail' && (
              detailLoading || !activityDetail ? (
                <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
                  {detailLoading ? 'Loading…' : 'No data'}
                </div>
              ) : (
                <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenInPlanner} onPhotoClick={handlePhotoClick} osDark={osDark} />
              )
            )}
            {mode === 'about' && (
              <AboutSection onBack={handleCloseAbout} />
            )}
          </MobileBottomSheet>
        </>
      )}

      {mode === 'planner' && (
        <>
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
            isMobile
            onToggleLayers={() => setMobilePlannerLayersOpen(v => !v)}
            onExportGpx={handleMobileExportGpx}
          />
          {/* Note: onGeolocate kept for prop compat but Locate button moved to map chrome */}

          {/* Layers panel */}
          <LayersPanel state={layerState} onChange={patchLayers} bottom={168} fixed forceOpen={mobilePlannerLayersOpen} isOwner={isOwner} />

          {/* Bottom HUD — draggable */}
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
                background: 'var(--glass-hvy)', backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderTop: '1px solid var(--p3)', borderRadius: '12px 12px 0 0',
                zIndex: 20,
                display: 'flex', flexDirection: 'column',
                transition: plannerHudDragging ? 'none' : 'height 0.3s ease',
                touchAction: 'none',
                overflow: 'hidden',
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
