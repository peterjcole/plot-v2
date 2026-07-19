'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Download, Upload, ChevronRight, MapPin } from 'lucide-react';
import ImportRoutePopover from '@/app/components/shell/ImportRoutePopover';
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
import { getActiveRouteId, setActiveRouteId } from '@/lib/active-route';
import { replayToCursor } from '@/lib/route-actions';
import {
  listRoutes, createRoute, getRoute, updateRoute, duplicateRoute, deleteRoute,
  displayRouteLabel, routeExportName, routeLabelStyle, UNTITLED_ROUTE_NAME, type RouteSummary,
} from '@/lib/saved-routes';
import { selectGpxWaypoints, downloadGpx, parseGpx } from '@/lib/gpx';
import { elevationGain } from '@/lib/elevation';
import { OS_PROJECTION } from '@/lib/map-config';
import LeftPanel from './LeftPanel';
import BrowsePanel from './BrowsePanel';
import DetailPanel from './DetailPanel';
import PlannerPanel from './PlannerPanel';
import SavedRoutesPicker from './SavedRoutesPicker';
import MobileRoutesSheet from './MobileRoutesSheet';
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
import ElevationChart, { type ElevationHoverPoint } from '@/app/(main)/planner/ElevationChart';
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

// Padding for fitting a route's bounding extent into the visible map area.
// On mobile, the bottom sheet covers ~50% (no photos) or ~72% (with photos) of the
// viewport, so the bottom padding must reserve that space to keep the route visible.
function getRouteFitPadding(hasPhotos: boolean): number[] {
  const isDesktop = window.matchMedia('(min-width: 640px)').matches;
  if (isDesktop) return [60, 60, 60, 60];
  return [100, 40, Math.round(window.innerHeight * (hasPhotos ? 0.72 : 0.5)) + 40, 40];
}

interface MapShellProps {
  activities: ActivitySummary[];
  avatarInitials: string;
  isLoggedIn?: boolean;
  isPremium?: boolean;
  initialMode?: PanelMode;
  initialSelectedId?: string | null;
  initialRouteId?: string | null;
  authError?: boolean;
}

export default function MapShell({ activities, avatarInitials, isLoggedIn = false, isPremium = false, initialMode = 'browse', initialSelectedId = null, initialRouteId = null, authError = false }: MapShellProps) {
  const [mode, setMode] = useState<PanelMode>(initialSelectedId ? 'detail' : initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detailSnap, setDetailSnap] = useState<'mid' | 'expanded'>('mid');
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
  const [explorerStats, setExplorerStats] = useState<{ yardSize: number; tileCount: number } | null>(null);

  // Sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Elevation chart hover → map crosshair
  const [elevationHoverPoint, setElevationHoverPoint] = useState<ElevationHoverPoint | null>(null);
  const handleElevationHover = useCallback((pt: ElevationHoverPoint | null) => setElevationHoverPoint(pt), []);

  // Planner state
  const { waypoints, segments, canUndo, canRedo, dispatch, restore, actions, cursor } = useRouteHistory();
  const [addPointsEnabled, setAddPointsEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const mapInstanceRef = useRef<Map | null>(null);
  // Set right before a programmatic setCenter/setZoom/fit (applying a route's own saved or
  // fitted view) so the moveend handler below can tell that apart from a genuine user pan —
  // otherwise re-viewing a route re-triggers its own autosave for no reason, and worse, can
  // write whatever the map happens to be showing 1800ms later into the wrong route's row if
  // the user has switched again by then.
  const applyingProgrammaticViewRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointsRef = useRef(waypoints);
  const segmentsRef = useRef(segments);
  const actionsRef = useRef(actions);
  const cursorRef = useRef(cursor);
  waypointsRef.current = waypoints;
  segmentsRef.current = segments;
  actionsRef.current = actions;
  cursorRef.current = cursor;

  useRouteSnapping({ waypoints, segments, dispatch });
  const { elevationData, isLoading: isLoadingElevation } = useElevationProfile(waypoints, segments);

  const distance = useMemo(() => calculateDistance(waypoints, segments), [waypoints, segments]);
  const distanceRef = useRef(distance);
  distanceRef.current = distance;

  // ── Saved routes (premium) ─────────────────────────────────────────────
  const [routesList, setRoutesList] = useState<RouteSummary[]>([]);
  const [routeMeta, setRouteMeta] = useState<{ id: string | null; name: string; location: string | null }>({ id: null, name: 'Untitled route', location: null });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isLocating, setIsLocating] = useState(false);
  const [routeHydrated, setRouteHydrated] = useState(false);
  const [mobileRoutesSheetOpen, setMobileRoutesSheetOpen] = useState(false);
  const [premiumInitialView, setPremiumInitialView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const routeMetaRef = useRef(routeMeta);
  routeMetaRef.current = routeMeta;

  // Overlay the active route's live in-memory state (name, location, stats) onto its row
  // in the list — renames and stat changes must show up immediately, not just after the
  // next backend refetch (autosave is debounced, so waiting for it would lag visibly).
  const displayRoutesList = useMemo(() => {
    if (!routeMeta.id) return routesList;
    return routesList.map((r) => r.id === routeMeta.id
      ? { ...r, name: routeMeta.name, location: routeMeta.location, distanceM: distance, waypointCount: waypoints.length }
      : r);
  }, [routesList, routeMeta.id, routeMeta.name, routeMeta.location, distance, waypoints.length]);

  const hydratedRef = useRef(false);
  const createInFlightRef = useRef(false);
  const suppressNextAutosaveRef = useRef(false);
  const premiumSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialized form of the payload last confirmed saved (or just hydrated from the server) —
  // schedulePremiumSave diffs against this before issuing a PUT, so a trigger whose net
  // payload hasn't actually changed (e.g. a view-only nudge right after load) doesn't write
  // a no-op update. `null` until the first hydration/save lands, which correctly means "no
  // baseline yet, always save" for a genuinely new route.
  const savedSnapshotRef = useRef<string | null>(null);

  const refreshRoutesList = useCallback(() => {
    if (!isPremium) return;
    listRoutes().then(setRoutesList);
  }, [isPremium]);

  useEffect(() => { refreshRoutesList(); }, [refreshRoutesList]);

  // Shape (and key order) must match applyDetail's snapshot below, since the dirty-check is a
  // plain string compare.
  const buildSavePayload = useCallback(() => {
    const map = mapInstanceRef.current;
    const center = (map?.getView().getCenter() as [number, number]) ?? [0, 0];
    const zoom = map?.getView().getZoom() ?? 7;
    return {
      name: routeMetaRef.current.name,
      location: routeMetaRef.current.location,
      distanceM: distanceRef.current,
      waypointCount: waypointsRef.current.length,
      actions: actionsRef.current,
      cursor: cursorRef.current,
      mapCenter: center,
      mapZoom: zoom,
    };
  }, []);

  // Debounced PUT — shared by the content-change effect and the moveend map handler below,
  // matching the existing dual-trigger local autosave pattern.
  const schedulePremiumSave = useCallback(() => {
    if (!isPremium || !routeMetaRef.current.id) return;
    // Clear any pending save before the suppress check — otherwise a save left over from
    // the route we just switched away from (still in-flight within its debounce window)
    // fires later and issues a redundant PUT against the newly-active route.
    if (premiumSaveTimerRef.current) clearTimeout(premiumSaveTimerRef.current);
    if (suppressNextAutosaveRef.current) {
      suppressNextAutosaveRef.current = false;
      return;
    }
    setSaveStatus('saving');
    premiumSaveTimerRef.current = setTimeout(() => {
      const id = routeMetaRef.current.id;
      if (!id) return;
      const payload = buildSavePayload();
      const serialized = JSON.stringify(payload);
      if (savedSnapshotRef.current === serialized) {
        // Nothing in the actual saved shape changed since the last save/hydration — this
        // trigger came from a view/derived-state nudge, not a real edit. Don't burn a PUT
        // (and the downstream "route updated" signal it causes on the phone) on a no-op.
        setSaveStatus('saved');
        return;
      }
      updateRoute(id, payload).then((summary) => {
        if (summary) { savedSnapshotRef.current = serialized; setSaveStatus('saved'); return; }
        // PUT failed (most likely a 404 — the route was deleted in another tab). Confirm
        // it's really gone rather than a transient blip, and if so, recreate it under a new
        // id so the work in progress isn't lost. If the user has since switched routes,
        // leave saveStatus alone — it belongs to whatever route is active now.
        if (routeMetaRef.current.id !== id) return;
        getRoute(id).then((stillThere) => {
          if (stillThere || routeMetaRef.current.id !== id) return;
          createRoute(routeMetaRef.current.name).then((created) => {
            if (!created || routeMetaRef.current.id !== id) return;
            geocodedRouteIdRef.current = null;
            setRouteMeta((m) => (m.id === id ? { ...m, id: created.id } : m));
            setActiveRouteId(created.id);
            refreshRoutesList();
          });
        });
      });
    }, 1800);
  }, [isPremium, refreshRoutesList, buildSavePayload]);

  // Hydrate the active route on mount — premium fetches from the backend, free reads
  // localStorage (unchanged mechanism, just the new action-log shape). routeHydrated
  // gates the route-identity UI so it doesn't flash "Untitled route" before the real
  // name (if any) has loaded.
  useEffect(() => {
    if (!isPremium) {
      const stored = loadRoute();
      if (stored?.actions?.length) {
        restore({ actions: stored.actions, cursor: stored.cursor });
      }
      hydratedRef.current = true;
      setRouteHydrated(true);
      return;
    }

    const applyDetail = (detail: NonNullable<Awaited<ReturnType<typeof getRoute>>>) => {
      suppressNextAutosaveRef.current = true;
      restore({ actions: detail.actions, cursor: detail.cursor });
      setRouteMeta({ id: detail.id, name: detail.name, location: detail.location });
      setActiveRouteId(detail.id);
      setPremiumInitialView({ center: detail.mapCenter, zoom: detail.mapZoom });
      // Baseline for schedulePremiumSave's dirty-check — same key order as buildSavePayload,
      // since the compare is a plain string equality. Opening this route now writes nothing
      // until something actually diverges from what the server just gave us.
      savedSnapshotRef.current = JSON.stringify({
        name: detail.name,
        location: detail.location,
        distanceM: detail.distanceM,
        waypointCount: detail.waypointCount,
        actions: detail.actions,
        cursor: detail.cursor,
        mapCenter: detail.mapCenter,
        mapZoom: detail.mapZoom,
      });
    };
    const finishEmpty = () => {
      setActiveRouteId(null);
      hydratedRef.current = true;
      setRouteHydrated(true);
    };

    (async () => {
      // A route id in the URL (/planner?route=<id>) takes precedence over the localStorage
      // pointer — this is what makes a saved-route link shareable/reloadable.
      const storedId = getActiveRouteId();
      const id = initialRouteId ?? storedId;
      if (!id) {
        finishEmpty();
        return;
      }
      const detail = await getRoute(id);
      // The user may have already started a route by hand, or opened an activity into the
      // planner, while this fetch was in flight — don't clobber that with stale hydration.
      if (waypointsRef.current.length > 0) {
        hydratedRef.current = true;
        setRouteHydrated(true);
        return;
      }
      if (detail) {
        applyDetail(detail);
        hydratedRef.current = true;
        setRouteHydrated(true);
        return;
      }
      // The URL's id 404'd (deleted, or not ours) — fall back to the localStorage pointer
      // rather than leaving the planner stuck on a dead id.
      if (initialRouteId && storedId && storedId !== initialRouteId) {
        const fallback = await getRoute(storedId);
        if (waypointsRef.current.length > 0) {
          hydratedRef.current = true;
          setRouteHydrated(true);
          return;
        }
        if (fallback) {
          applyDetail(fallback);
          hydratedRef.current = true;
          setRouteHydrated(true);
          return;
        }
      }
      finishEmpty();
    })();
    // Runs once on mount — isPremium/initialRouteId are stable props for the lifetime of a session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the premium route's saved map view once the map is ready (fetch and map-ready
  // can resolve in either order).
  useEffect(() => {
    if (!mapReady || !premiumInitialView) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    applyingProgrammaticViewRef.current = true;
    if (isValidBNG(premiumInitialView.center)) {
      map.getView().setCenter(premiumInitialView.center);
      map.getView().setZoom(premiumInitialView.zoom);
    } else {
      // No real saved view yet — e.g. a route that was auto-created and never manually
      // repositioned still has its create-time default ([0,0], zoom 7), which fails the BNG
      // check. Fit to the route's own waypoints instead of silently leaving the map wherever
      // it was previously pointed (which reads as "the wrong route's location").
      const wps = waypointsRef.current;
      if (wps.length >= 2) {
        const coords = wps.map((wp) => fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code));
        map.getView().fit(boundingExtent(coords), { padding: [60, 60, 60, 60], maxZoom: 9 });
      } else {
        applyingProgrammaticViewRef.current = false;
      }
    }
    setPremiumInitialView(null);
  }, [mapReady, premiumInitialView]);

  // Create the backend route record silently on the first waypoint of a fresh session
  // (no active route yet) — mirrors the free-tier "autosave-first" behaviour.
  useEffect(() => {
    if (!isPremium || !hydratedRef.current) return;
    if (routeMeta.id || waypoints.length === 0 || createInFlightRef.current) return;
    createInFlightRef.current = true;
    createRoute('Untitled route').then((summary) => {
      createInFlightRef.current = false;
      if (!summary) return;
      setActiveRouteId(summary.id);
      setRouteMeta({ id: summary.id, name: summary.name, location: summary.location });
      refreshRoutesList();
    });
  }, [isPremium, routeMeta.id, waypoints.length, refreshRoutesList]);

  // Reverse-geocode the start point whenever the active route has waypoints but no
  // location yet — covers every path that can produce that state (auto-created on first
  // waypoint, explicit "+ New route" then plotting, or a hydrated/older route that never
  // got a location). Guarded per-route-id so it fires once, not on every waypoint edit.
  const geocodedRouteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPremium || !routeMeta.id || routeMeta.location || waypoints.length === 0) return;
    if (geocodedRouteIdRef.current === routeMeta.id) return;
    geocodedRouteIdRef.current = routeMeta.id;
    const id = routeMeta.id;
    const first = waypointsRef.current[0];
    if (!first) return;
    setIsLocating(true);
    fetch(`/api/geocode/reverse?lat=${first.lat}&lng=${first.lng}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { location?: string | null } | null) => {
        if (data?.location) {
          setRouteMeta((m) => (m.id === id ? { ...m, location: data.location ?? null } : m));
          // The geocoded location is a derived nicety, not a user edit — treat it as
          // already "saved" so this alone doesn't trigger a PUT (and the phone-side
          // "route updated" it would cause). It's still captured: the next genuine edit's
          // payload carries it and persists it for real. Spreading over the existing
          // snapshot preserves buildSavePayload's key order.
          if (savedSnapshotRef.current) {
            try {
              const snap = JSON.parse(savedSnapshotRef.current);
              savedSnapshotRef.current = JSON.stringify({ ...snap, location: data.location ?? null });
            } catch { /* malformed snapshot — leave it; worst case one extra real save */ }
          }
        }
      })
      .catch(() => { /* silently ignore — location is a nice-to-have, not load-bearing */ })
      .finally(() => setIsLocating(false));
  }, [isPremium, routeMeta.id, routeMeta.location, waypoints.length]);

  // A GPX/Strava import replaces the whole route with a new start point, so the previously
  // geocoded location is stale. Clearing it (and the per-id guard above) lets the geocode
  // effect re-fire against the new first waypoint. No-op on free tier / before a route exists.
  const handleRouteReplaced = useCallback(() => {
    if (!isPremium || !routeMetaRef.current.id) return;
    geocodedRouteIdRef.current = null;
    setRouteMeta((m) => ({ ...m, location: null }));
  }, [isPremium]);

  // Premium autosave — triggers on content or identity changes; moveend (below) triggers
  // the same debounce for map-view-only changes. routeMeta.id is included so that a route
  // whose id is (re)adopted after its content is already set — e.g. the activity-into-planner
  // flow, or the delete-recovery path above — actually gets its content persisted; every
  // other setRouteMeta({id}) call site pairs the id change with suppressNextAutosaveRef, so
  // this doesn't cause a double-save there.
  useEffect(() => {
    schedulePremiumSave();
  }, [actions, cursor, routeMeta.id, routeMeta.name, routeMeta.location, schedulePremiumSave]);

  const handleSelectRoute = useCallback((id: string) => {
    if (id === routeMetaRef.current.id) return;
    setRouteHydrated(false);
    getRoute(id).then((detail) => {
      if (!detail) {
        // Row was stale — probably deleted in another tab. Drop it from the list so it
        // doesn't sit there looking selectable but dead.
        refreshRoutesList();
        setRouteHydrated(true);
        return;
      }
      suppressNextAutosaveRef.current = true;
      restore({ actions: detail.actions, cursor: detail.cursor });
      setRouteMeta({ id: detail.id, name: detail.name, location: detail.location });
      setActiveRouteId(detail.id);
      setPremiumInitialView({ center: detail.mapCenter, zoom: detail.mapZoom });
      setRouteHydrated(true);
    });
  }, [restore, refreshRoutesList]);

  const handleCreateNewRoute = useCallback(() => {
    createRoute('Untitled route').then((summary) => {
      if (!summary) return;
      suppressNextAutosaveRef.current = true;
      restore({ actions: [], cursor: 0 });
      setRouteMeta({ id: summary.id, name: summary.name, location: summary.location });
      setActiveRouteId(summary.id);
      refreshRoutesList();
    });
  }, [restore, refreshRoutesList]);

  const handleRenameActive = useCallback((name: string) => {
    setRouteMeta((m) => ({ ...m, name }));
  }, []);

  const handleRenameRoute = useCallback((id: string, name: string) => {
    if (id === routeMetaRef.current.id) {
      setRouteMeta((m) => ({ ...m, name }));
      return;
    }
    getRoute(id).then((detail) => {
      if (!detail) return;
      updateRoute(id, {
        name,
        location: detail.location,
        distanceM: detail.distanceM,
        waypointCount: detail.waypointCount,
        actions: detail.actions,
        cursor: detail.cursor,
        mapCenter: detail.mapCenter,
        mapZoom: detail.mapZoom,
        mapRotation: detail.mapRotation,
      }).then(() => refreshRoutesList());
    });
  }, [refreshRoutesList]);

  const handleDuplicateRoute = useCallback((id: string) => {
    (async () => {
      let wps = waypointsRef.current;
      let segs = segmentsRef.current;
      let baseName = routeMetaRef.current.name;
      if (id !== routeMetaRef.current.id) {
        const detail = await getRoute(id);
        if (!detail) return;
        const replayed = replayToCursor(detail.actions, detail.cursor);
        wps = replayed.waypoints;
        segs = replayed.segments;
        baseName = detail.name;
      }
      await duplicateRoute(id, `${baseName} (copy)`, wps, segs);
      refreshRoutesList();
    })();
  }, [refreshRoutesList]);

  const handleDeleteRoute = useCallback((id: string) => {
    deleteRoute(id).then((ok) => {
      if (!ok) return;
      if (id === routeMetaRef.current.id) {
        const next = routesList.find((r) => r.id !== id);
        if (next) {
          handleSelectRoute(next.id);
        } else {
          setActiveRouteId(null);
          setRouteMeta({ id: null, name: 'Untitled route', location: null });
          suppressNextAutosaveRef.current = true;
          restore({ actions: [], cursor: 0 });
        }
      }
      refreshRoutesList();
    });
  }, [routesList, handleSelectRoute, restore, refreshRoutesList]);

  const elevGain = useMemo(() => {
    if (!elevationData || elevationData.length < 2) return 0;
    return elevationGain(elevationData);
  }, [elevationData]);

  const [mobilePlannerLayersOpen, setMobilePlannerLayersOpen] = useState(false);
  const [mobileImportAnchor, setMobileImportAnchor] = useState<DOMRect | null>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // ── Extracted hooks ───────────────────────────────────────────────────────
  const { theme, osDark, handleThemeChange } = useTheme();
  const { allActivities, isLoadingMore, hasMore, hoveredId, setHoveredId, handleLoadMore } = useActivityBrowse(activities);
  const { activityDetail, setActivityDetail, detailLoading } = useActivityDetail(selectedId);

  // When the selected activity isn't in the paginated list (page 2+), inject a synthetic
  // summary so MainMap can render its trace. Only used for MainMap — not BrowsePanel.
  const activitiesForMap = useMemo(() => {
    if (!activityDetail || !selectedId) return allActivities;
    if (allActivities.some(a => String(a.id) === selectedId)) return allActivities;
    const synthetic: ActivitySummary = {
      id: Number(activityDetail.id),
      name: activityDetail.name,
      type: activityDetail.type ?? 'Ride',
      startDate: activityDetail.stats.startDate,
      distance: activityDetail.stats.distance,
      movingTime: activityDetail.stats.movingTime,
      elevationGain: activityDetail.stats.elevationGain,
      photoCount: activityDetail.photos.length,
      route: activityDetail.route,
    };
    return [synthetic, ...allActivities];
  }, [allActivities, activityDetail, selectedId]);

  const { lightboxPhotos, lightboxOpen, lightboxIndex, handlePhotoClick, handleLightboxClose, handlePhotoMarkerClick } = useLightbox(activityDetail, selectedId);
  const { plannerHudHeight, setPlannerHudHeight, plannerHudDragging, handlePlannerHudTouchStart, handlePlannerHudTouchMove, handlePlannerHudTouchEnd, guardTap } = usePlannerHud();
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
  } = useWaypointInteraction(waypoints, segments, dispatch, mapInstanceRef, snapEnabled);

  const photosImportTriggeredRef = useRef(false);

  // Trigger photo catch-up import the first time "My photos" is enabled
  useEffect(() => {
    if (!isPremium || !layerState.showPhotos || photosImportTriggeredRef.current) return;
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
  }, [isPremium, layerState.showPhotos]);

  // Reflect panel mode in URL bar (no navigation, just history state). Premium planner
  // routes carry their short route id (?route=<id>) so the URL is shareable/reloadable;
  // free users always get a bare /planner — they have no saved-route id to carry.
  useEffect(() => {
    let path = '/';
    if (mode === 'detail' && selectedId) path = `/?activity=${selectedId}`;
    else if (mode === 'planner') path = isPremium && routeMeta.id ? `/planner?route=${routeMeta.id}` : '/planner';
    else if (mode === 'about') path = '/about';
    window.history.replaceState(null, '', path);
  }, [mode, selectedId, isPremium, routeMeta.id]);

  // Auto-save route locally — free tier only; premium autosave is the effect above.
  // Only runs when map is ready to avoid persisting [0,0] center.
  useEffect(() => {
    if (isPremium) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      const center = map.getView().getCenter() as [number, number];
      const zoom = map.getView().getZoom() ?? 7;
      saveRoute({ actions: actionsRef.current, cursor: cursorRef.current, mapCenter: center, mapZoom: zoom });
    }, 500);
  }, [actions, cursor, isPremium]);

  const handleResetNorth = useCallback(() => {
    mapInstanceRef.current?.getView().animate({ rotation: 0, duration: 300 });
    setCompassBearing(0);
  }, []);

  const handleMapReady = useCallback((map: Map) => {
    mapInstanceRef.current = map;
    setMapReady(true);
    // In planner mode always restore stored position (the planner fit effect will override
    // this with the route bounds if there are waypoints). In browse mode only restore when
    // there are no activities so the activity list auto-fit can take over. Premium restores
    // its view separately (see the premiumInitialView effect above) once the fetch resolves.
    if (!isPremium && (initialMode === 'planner' || allActivities.length === 0)) {
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
      if (applyingProgrammaticViewRef.current) {
        // This moveend was caused by us applying a route's own (already-saved, or just-fit)
        // view on selection — not a user pan — so it's not something to save.
        applyingProgrammaticViewRef.current = false;
      } else if (center) {
        if (isPremium) {
          schedulePremiumSave();
        } else {
          saveRoute({ actions: actionsRef.current, cursor: cursorRef.current, mapCenter: center, mapZoom: zoom });
        }
      }
      setCompassBearing(view.getRotation() * 180 / Math.PI);
      setMapResolution(view.getResolution() ?? 10);
    });
  }, [allActivities.length, initialMode, isPremium, schedulePremiumSave]);

  // On initial /planner load, fit the map to the saved route once both the map and
  // waypoints are ready. Runs once — no animation so it snaps cleanly on load.
  const initialPlannerFitDoneRef = useRef(false);
  useEffect(() => {
    if (initialPlannerFitDoneRef.current) return;
    if (initialMode !== 'planner' || !mapReady || waypoints.length < 2) return;
    initialPlannerFitDoneRef.current = true;
    const map = mapInstanceRef.current;
    if (!map) return;
    // This fit is programmatic, same as the premiumInitialView effect above — without the
    // guard its moveend reaches the handleMapReady handler unmasked and schedules a save of
    // a view the user never actually chose, on every multi-waypoint route opened this way.
    applyingProgrammaticViewRef.current = true;
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
    const hasPhotos = activityDetail.photos.length > 0;
    setDetailSnap(hasPhotos ? 'expanded' : 'mid');
    const coords = route.map(([lat, lng]) => fromLonLat([lng, lat], OS_PROJECTION.code));
    mapInstanceRef.current.getView().fit(boundingExtent(coords), { padding: getRouteFitPadding(hasPhotos), maxZoom: 14 });
  // initialSelectedId is intentionally omitted from deps — it's a stable SSR prop that never
  // changes after mount. Adding it would cause a spurious re-run on every render.
  }, [mapReady, activityDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectActivity = useCallback((id: string) => {
    setSelectedId(id);
    setMode('detail');
    const summary = allActivities.find(a => String(a.id) === id);
    const hasPhotos = (summary?.photoCount ?? 0) > 0;
    setDetailSnap(hasPhotos ? 'expanded' : 'mid');
    if (summary?.route?.length && mapInstanceRef.current) {
      const coords = summary.route.map(([lat, lng]) => fromLonLat([lng, lat], OS_PROJECTION.code));
      mapInstanceRef.current.getView().fit(boundingExtent(coords), { padding: getRouteFitPadding(hasPhotos), duration: 500, maxZoom: 14 });
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
    // Free tier has a single working route, so loading an activity genuinely replaces it —
    // keep the confirm. Premium instead spins up a dedicated new route below, so nothing is
    // lost and no confirm is needed.
    if (!isPremium && waypoints.length > 0 && !window.confirm('Load this activity into the planner? This will replace your current route.')) return;
    const rawWaypoints = activityDetail.route.map(([lat, lng]) => ({ lat, lng }));
    // Create via-points every 2km with full track coordinates in each segment (same as GPX import)
    const { waypoints: viaPoints, segments: viaSegments } = selectGpxWaypoints(rawWaypoints, 2);
    if (isPremium) {
      // Detach from whatever route is currently active so the pending autosave can't PUT
      // this activity's track over it, and hold off the generic auto-create effect (it would
      // otherwise race in and mint a plain "Untitled route" for the same first waypoint).
      const newName = `Route from '${activityDetail.name}'`;
      createInFlightRef.current = true;
      geocodedRouteIdRef.current = null;
      setActiveRouteId(null);
      setRouteMeta({ id: null, name: newName, location: null });
      dispatch({ type: 'LOAD', waypoints: viaPoints, segments: viaSegments });
      createRoute(newName).then((summary) => {
        createInFlightRef.current = false;
        if (summary) {
          setRouteMeta({ id: summary.id, name: summary.name, location: summary.location });
          setActiveRouteId(summary.id);
          refreshRoutesList();
          return;
        }
        // createRoute failed (network hiccup) — retry once with a generic name. Nothing else
        // will retry this: the auto-create effect's own deps (routeMeta.id, waypoints.length)
        // haven't changed just because this ref flipped back to false, so it won't refire.
        createRoute(UNTITLED_ROUTE_NAME).then((fallback) => {
          if (!fallback) return;
          setRouteMeta({ id: fallback.id, name: fallback.name, location: fallback.location });
          setActiveRouteId(fallback.id);
          refreshRoutesList();
        });
      });
    } else {
      dispatch({ type: 'LOAD', waypoints: viaPoints, segments: viaSegments });
    }
    setLoadedActivityId(String(activityDetail.id));
    setMode('planner');
    setSelectedId(null);
    setActivityDetail(null);
    handleFitToRoute(viaPoints);
  }, [activityDetail, dispatch, handleFitToRoute, handleOpenPlanner, isPremium, waypoints.length, setActivityDetail, refreshRoutesList]);

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
    downloadGpx(waypoints, segments, routeExportName(routeMetaRef.current));
  }, [waypoints, segments]);

  const handleMobileGpxImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (waypoints.length > 0 && !window.confirm('Replace the current route with the imported route?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== 'string') return;
      const trackPoints = parseGpx(content);
      const { waypoints: viaPoints, segments: viaSegments } = selectGpxWaypoints(trackPoints, 2);
      if (viaPoints.length >= 1) {
        dispatch({ type: 'LOAD', waypoints: viaPoints, segments: viaSegments });
        handleFitToRoute(viaPoints);
        handleRouteReplaced();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [waypoints.length, dispatch, handleFitToRoute, handleRouteReplaced]);

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
    ? { waypoints, segments, dispatch, addPointsEnabled, snapEnabled }
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
                <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenInPlanner} onPhotoClick={handlePhotoClick} osDark={osDark} exportBaseMap={layerState.baseLayer === 'satellite' ? 'satellite' : 'os'} exportHillshade={layerState.showHillshade} onElevationHover={handleElevationHover} />
              )}
            </div>
          )}
          {mode === 'planner' && (
            <div className="panel-fade-in" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {isPremium && (
                <SavedRoutesPicker
                  loading={!routeHydrated}
                  routeName={routeMeta.name}
                  routeLocation={routeMeta.location}
                  isLocating={isLocating}
                  saveStatus={saveStatus}
                  routes={displayRoutesList}
                  activeRouteId={routeMeta.id}
                  onOpen={refreshRoutesList}
                  onSelectRoute={handleSelectRoute}
                  onCreateRoute={handleCreateNewRoute}
                  onRenameActive={handleRenameActive}
                  onRenameRoute={handleRenameRoute}
                  onDuplicateRoute={handleDuplicateRoute}
                  onDeleteRoute={handleDeleteRoute}
                />
              )}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                  onExportGpx={handleMobileExportGpx}
                  isExportingImage={isExportingImage}
                  onEditWaypoint={handleEditWaypoint}
                  onElevationHover={handleElevationHover}
                />
              </div>
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
          activities={activitiesForMap}
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
          onExplorerStats={setExplorerStats}
          showOwnerPhotos={isPremium && layerState.showPhotos}
          onPhotoClick={handleOwnerPhotoClick}
          onClusterPhotosClick={handleOwnerClusterPhotosClick}
          onHeatmapClick={isPremium ? handleHeatmapClick : undefined}
          hoveredActivityRoute={hoveredActivityRoute}
          hoveredActivityColor={hoveredActivityColor}
          onGeolocate={handleGeolocate}
          onPlaceSelect={handlePlaceSelect}
          detailRoute={activityDetail?.route ?? null}
          elevationHoverPoint={elevationHoverPoint}
        />

        {/* Desktop chrome — layers, compass, scale, legend (hidden on mobile) */}
        <div className="hidden sm:block">
          <LayersPanel state={layerState} onChange={patchLayers} bottom={16} isPremium={isPremium} theme={theme} onThemeChange={handleThemeChange} explorerStats={explorerStats} />
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
            onReverse={() => dispatch({ type: 'REVERSE' })}
            onToggleLayers={() => setMobilePlannerLayersOpen(v => !v)}
            onExportGpx={handleMobileExportGpx}
            onImported={handleRouteReplaced}
          />
        )}
      </div>

      {/* ── Mobile-only chrome (hidden on desktop) ───────────────────────── */}
      <div className="sm:hidden">
        <MobileHeader
          avatarInitials={avatarInitials}
          isLoggedIn={isLoggedIn}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          mode={mode}
          activityName={mode === 'detail' && activityDetail ? activityDetail.name : undefined}
          activityType={mode === 'detail' && activityDetail ? activityDetail.type : undefined}
          onBack={handleBack}
          onAbout={handleOpenAbout}
        />


      {/* Map chrome — bottom-left cluster (above the buttons) */}
      <div style={{ position: 'fixed', bottom: 201, left: 12, zIndex: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Compass bearing={compassBearing} onResetNorth={handleResetNorth} />
        {mode !== 'planner' && <ScaleBar metersPerPixel={mapResolution} />}
      </div>

      {/* Conditional non-animated elements */}
      {mode !== 'planner' && (
        <>
          <LayersPanel state={layerState} onChange={patchLayers} fixed topRight topOffset={80} isPremium={isPremium} theme={theme} onThemeChange={handleThemeChange} explorerStats={explorerStats} triggerStyle={{ borderRadius: '50%', background: 'var(--glass-hvy)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
          <button
            onClick={handleOpenPlanner}
            style={{
              position: 'fixed',
              right: 16,
              bottom: 149,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--ora)',
              border: 'none',
              color: 'var(--p0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 18,
              boxShadow: '0 4px 14px rgba(224,112,32,.4)',
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
        <LayersPanel state={layerState} onChange={patchLayers} fixed topRight topOffset={126} forceOpen={mobilePlannerLayersOpen} isPremium={isPremium} theme={theme} onThemeChange={handleThemeChange} explorerStats={explorerStats} triggerStyle={{ borderRadius: '50%', background: 'var(--glass-hvy)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} />
      )}

      {/* Activities bottom sheet — always mounted, crossfades out when entering planner */}
      <MobileBottomSheet
        title={sheetTitle}
        count={sheetCount}
        defaultSnap={mode === 'about' ? 'expanded' : mode === 'detail' ? detailSnap : isLoggedIn ? 'expanded' : 'mid'}
        hideHeader={mode === 'detail'}
        showSearch={isLoggedIn}
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
            <DetailPanel activity={activityDetail} onBack={handleBack} onOpenPlanner={handleOpenInPlanner} onPhotoClick={handlePhotoClick} osDark={osDark} exportBaseMap={layerState.baseLayer === 'satellite' ? 'satellite' : 'os'} exportHillshade={layerState.showHillshade} hideHeader onElevationHover={handleElevationHover} />
          )
        )}
        {mode === 'about' && (
          <AboutSection onBack={handleCloseAbout} />
        )}
      </MobileBottomSheet>

      {/* Planner HUD — always mounted, crossfades in when entering planner */}
      {(() => {
        const distKm = (distance / 1000).toFixed(1);
        const { label: routeLabel, kind: routeLabelKind } = displayRouteLabel({ name: routeMeta.name, location: routeMeta.location });
        const usingLocationAsName = routeMeta.name === UNTITLED_ROUTE_NAME && !!routeMeta.location;
        return (
          <div style={{
            position: 'fixed', bottom: 10, left: 10, right: 10,
            height: plannerHudHeight,
            background: 'var(--p1)',
            border: '1px solid var(--p3)', borderRadius: 16,
            boxShadow: '0 -4px 24px rgba(0,0,0,.35)',
            zIndex: 20,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            touchAction: 'none',
            opacity: mode === 'planner' ? 1 : 0,
            pointerEvents: mode === 'planner' ? 'auto' : 'none',
            transform: mode === 'planner' ? 'translateY(0)' : 'translateY(100%)',
            transition: plannerHudDragging ? 'none' : 'height 0.3s ease, opacity 0.28s ease, transform 0.28s ease',
          }}>
                {/* Draggable zone — route identity + handle bar + stats, so swiping anywhere
                    across the route's attributes resizes the sheet. Taps still open the
                    routes sheet / toggle height, guarded so a drag-release doesn't also
                    register as a tap (see usePlannerHud's guardTap). */}
                <div
                  onTouchStart={handlePlannerHudTouchStart}
                  onTouchMove={handlePlannerHudTouchMove}
                  onTouchEnd={handlePlannerHudTouchEnd}
                  style={{ flexShrink: 0, userSelect: 'none', cursor: 'grab' }}
                >
                  {isPremium && (
                    <>
                      <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: .5; } 50% { opacity: .15; } }`}</style>
                      {routeHydrated ? (
                        <div
                          onClick={guardTap(() => { refreshRoutesList(); setMobileRoutesSheetOpen(true); })}
                          style={{
                            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 16px 0', cursor: 'pointer',
                          }}
                        >
                          <span style={{
                            font: '600 11px/1.3 var(--mono)', ...routeLabelStyle(routeLabelKind),
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {routeLabel}
                          </span>
                          {!usingLocationAsName && (routeMeta.location || isLocating) && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, font: '400 9px/1 var(--mono)', color: 'var(--fog-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                              {routeMeta.location && <MapPin size={9} style={{ flexShrink: 0 }} />}
                              {routeMeta.location ?? 'Locating…'}
                            </span>
                          )}
                          <div style={{ flex: 1 }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 8px/1 var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--fog-dim)', flexShrink: 0 }}>
                            <div style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: saveStatus === 'saving' ? 'var(--fog-dim)' : 'var(--grn)',
                              boxShadow: saveStatus === 'saving' ? 'none' : '0 0 4px var(--grn)',
                            }} />
                            {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
                          </div>
                          <ChevronRight size={13} style={{ color: 'var(--fog-dim)', flexShrink: 0 }} />
                        </div>
                      ) : (
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '10px 16px 0' }}>
                          <div style={{ width: 110, height: 11, borderRadius: 2, background: 'var(--p3)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
                        </div>
                      )}
                    </>
                  )}
                  <div
                    onClick={guardTap(() => setPlannerHudHeight(h => h > PLANNER_HUD_COLLAPSED + 5 ? PLANNER_HUD_COLLAPSED : PLANNER_HUD_EXPANDED))}
                  >
                    <div style={{ padding: '12px 0 8px' }}>
                      <div style={{ width: 56, height: 6, background: 'var(--p3)', borderRadius: 3, margin: '0 auto' }} />
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
                  </div>
                </div>{/* end drag zone */}
                <div style={{ position: 'relative', padding: '0 16px 10px' }}>
                  <ElevationChart data={elevationData} onHover={handleElevationHover} height={34} />
                  {elevationData && (
                    <div style={{ position: 'absolute', bottom: 13, right: 18, font: '400 7px/1 var(--mono)', color: 'var(--fog-dim)', pointerEvents: 'none' }}>{distKm}km</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '0 16px 14px' }}>
                  <button
                    onClick={(e) => setMobileImportAnchor((e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
                    style={{ flex: 1, height: 40, borderRadius: 4, border: 'none', background: 'var(--p3)', color: 'var(--fog)', font: '700 10px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Upload size={14} />
                    Import
                  </button>
                  <button
                    onClick={handleExportImage}
                    disabled={isExportingImage || waypoints.length === 0}
                    style={{ flex: 1, height: 40, borderRadius: 4, border: 'none', background: 'var(--p3)', color: waypoints.length === 0 ? 'var(--fog-dim)' : 'var(--fog)', font: '700 10px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {isExportingImage ? (
                      <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--fog-ghost)', borderTopColor: 'var(--ora)', animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <ImageIcon size={14} />
                    )}
                    Image
                  </button>
                  <button
                    onClick={handleMobileExportGpx}
                    disabled={waypoints.length === 0}
                    style={{ flex: 1, height: 40, borderRadius: 4, border: 'none', background: waypoints.length === 0 ? 'var(--p3)' : 'var(--ora)', color: waypoints.length === 0 ? 'var(--fog-dim)' : 'var(--p0)', font: '700 10px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', cursor: waypoints.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Download size={14} />
                    Export
                  </button>
                </div>
          </div>
          );
        })()}
      </div>{/* end sm:hidden mobile chrome */}

      {/* Mobile GPX file input — triggers from ImportRoutePopover on mobile */}
      <input type="file" accept=".gpx" style={{ display: 'none' }} ref={mobileFileInputRef} onChange={handleMobileGpxImport} />

      {/* Mobile import route popover */}
      {mobileImportAnchor && createPortal(
        <ImportRoutePopover
          anchorRect={mobileImportAnchor}
          onClose={() => setMobileImportAnchor(null)}
          dispatch={dispatch}
          waypoints={waypoints}
          onFitToRoute={handleFitToRoute}
          fileInputRef={mobileFileInputRef}
          onImported={handleRouteReplaced}
        />,
        document.body,
      )}

      {/* Mobile "My Routes" sheet — premium only */}
      {mobileRoutesSheetOpen && isPremium && createPortal(
        <MobileRoutesSheet
          routes={displayRoutesList}
          activeRouteId={routeMeta.id}
          onClose={() => setMobileRoutesSheetOpen(false)}
          onSelectRoute={handleSelectRoute}
          onCreateRoute={handleCreateNewRoute}
          onRenameRoute={handleRenameRoute}
          onDuplicateRoute={handleDuplicateRoute}
          onDeleteRoute={handleDeleteRoute}
        />,
        document.body,
      )}

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
