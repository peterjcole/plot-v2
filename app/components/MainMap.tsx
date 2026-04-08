'use client';

import { useRef, useEffect, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import TileGrid from 'ol/tilegrid/TileGrid';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OlVectorTileLayer from 'ol/layer/VectorTile';
import OlVectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Style, Stroke, Icon, Circle as CircleStyle, Fill } from 'ol/style';
import { Modify, DragPan } from 'ol/interaction';
import { get as getProjection, fromLonLat, toLonLat } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { getCenter, boundingExtent } from 'ol/extent';
import {
  OS_PROJECTION, OS_TILE_URL, OS_DARK_TILE_URL, TOPO_TILE_URL, TOPO_DARK_TILE_URL, SATELLITE_TILE_URL,
  HILLSHADE_TILE_URL, OS_DEFAULT_CENTER, OS_ZOOM,
} from '@/lib/map-config';
import { ActivitySummary, ActivityPhoto, Waypoint, RouteSegment } from '@/lib/types';
import { getActivityColor } from '@/lib/activity-categories';
import type { RouteAction } from '@/app/(main)/planner/useRouteHistory';
import 'ol/ol.css';

export type MapLayer = 'topo' | 'satellite';

export interface PlannerProps {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  dispatch: React.Dispatch<RouteAction>;
}

interface WaypointClickInfo {
  index: number;
  screenX: number;
  screenY: number;
}

interface MainMapProps {
  activities: ActivitySummary[];
  highlightedId?: string | null;
  selectedId?: string | null;
  showRecentActivities?: boolean;
  photoMarkers?: ActivityPhoto[];
  onActivitySelect?: (id: string) => void;
  onActivityHover?: (id: string | null) => void;
  onPhotoMarkerClick?: (photoId: string) => void;
  onWaypointClick?: (info: WaypointClickInfo) => void;
  loadedActivityId?: string;
  baseLayer?: MapLayer;
  plannerProps?: PlannerProps;
  onMapReady?: (map: Map) => void;
  osDark?: boolean;
  showHillshade?: boolean;
  showPhotos?: boolean;
  dimBaseMap?: boolean;
  showPersonalHeatmap?: boolean;
  showExplorer?: boolean;
  showPOIs?: boolean;
}

export type { WaypointClickInfo };

// ── Activity trace styles ────────────────────────────────────────────────────

function hexToComponents(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function routeStyles(color: string, alpha: number): Style[] {
  const [r, g, b] = hexToComponents(color);
  // Very dimmed — thin line only.
  if (alpha < 0.2) {
    return [new Style({ stroke: new Stroke({ color: `rgba(${r},${g},${b},${alpha})`, width: 5 }) })];
  }
  // Normal / hovered: clean single-colour stroke.
  return [new Style({ stroke: new Stroke({ color: `rgba(${r},${g},${b},${alpha})`, width: 9 }) })];
}

function pinIconSvg(hasPhoto: boolean): string {
  const fill = hasPhoto ? '#E07020' : '#1E3A42';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <path d="M10 27c-2-6-9-11-9-17a9 9 0 1 1 18 0c0 6-7 11-9 17Z" fill="${fill}" stroke="rgba(240,248,250,0.6)" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="3.5" fill="rgba(240,248,250,0.9)"/>
  </svg>`;
}

// ── Planner drawing styles ───────────────────────────────────────────────────

// Cased lines: dark outer border drawn first, orange inner on top.
// Layer opacity (0.52) makes the whole thing translucent so the map shows through the center.
const snappedRouteStyle = [
  new Style({ stroke: new Stroke({ color: 'rgba(7,14,20,0.95)', width: 16 }) }),
  new Style({ stroke: new Stroke({ color: '#E07020', width: 11 }) }),
];
const unsnappedRouteStyle = [
  new Style({ stroke: new Stroke({ color: 'rgba(7,14,20,0.85)', width: 15, lineDash: [12, 10] }) }),
  new Style({ stroke: new Stroke({ color: '#E07020', width: 10, lineDash: [12, 10] }) }),
];
const routingPendingStyle = [
  new Style({ stroke: new Stroke({ color: 'rgba(7,14,20,0.6)', width: 7, lineDash: [2, 6] }) }),
  new Style({ stroke: new Stroke({ color: 'rgba(224,112,32,0.7)', width: 4, lineDash: [2, 6] }) }),
];

function waypointPinSvg(index: number): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">' +
    '<path d="M16 44c-3-10-14-18-14-28a14 14 0 1 1 28 0c0 10-11 18-14 28Z" ' +
    'fill="rgba(14,40,48,0.92)" stroke="#E07020" stroke-width="2"/>' +
    '<text x="16" y="15" text-anchor="middle" dominant-baseline="central" ' +
    `fill="rgba(240,248,250,0.95)" font-size="13" font-weight="bold" font-family="sans-serif">${index + 1}</text>` +
    '</svg>'
  );
}

function waypointStyle(index: number): Style {
  return new Style({
    image: new Icon({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(waypointPinSvg(index))}`,
      anchor: [0.5, 1],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    }),
  });
}

function syncPlannerFeatures(
  wpSource: VectorSource,
  routeSource: VectorSource,
  waypoints: Waypoint[],
  segments: RouteSegment[],
) {
  wpSource.clear();
  waypoints.forEach((wp, i) => {
    const coord = fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code);
    const feature = new Feature({ geometry: new Point(coord), waypointIndex: i });
    feature.setStyle(waypointStyle(i));
    wpSource.addFeature(feature);
  });

  routeSource.clear();
  if (waypoints.length >= 2) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const seg = segments[i];
      const coords = seg?.coordinates.length >= 2
        ? seg.coordinates.map((c) => fromLonLat([c.lng, c.lat], OS_PROJECTION.code))
        : [
            fromLonLat([waypoints[i].lng, waypoints[i].lat], OS_PROJECTION.code),
            fromLonLat([waypoints[i + 1].lng, waypoints[i + 1].lat], OS_PROJECTION.code),
          ];
      const feature = new Feature({ geometry: new LineString(coords), segmentIndex: i, snapped: seg?.snapped ?? false });
      if (seg?.snapped && seg.coordinates.length >= 2) feature.setStyle(snappedRouteStyle);
      else if (seg?.snapped && seg.coordinates.length === 0) feature.setStyle(routingPendingStyle);
      else feature.setStyle(unsnappedRouteStyle);
      routeSource.addFeature(feature);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────

export default function MainMap({
  activities,
  highlightedId,
  selectedId,
  showRecentActivities = true,
  photoMarkers,
  onActivitySelect,
  onActivityHover,
  onPhotoMarkerClick,
  onWaypointClick,
  loadedActivityId,
  baseLayer = 'topo',
  plannerProps,
  onMapReady,
  osDark = true,
  showHillshade = false,
  showPhotos = true,
  dimBaseMap = false,
  showPersonalHeatmap = false,
  showExplorer = false,
  showPOIs = false,
}: MainMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const routeLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const selectedRouteSourceRef = useRef<VectorSource | null>(null);
  const selectedRouteLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const photoSourceRef = useRef<VectorSource | null>(null);
  const photoLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const topoLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const osOverviewLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const os25kLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const satelliteLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const hillshadeLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const personalHeatmapLayerRef = useRef<OlVectorTileLayer | null>(null);
  const fittedRef = useRef(false);

  // Zoom state for zoom buttons
  const [currentZoom, setCurrentZoom] = useState(OS_ZOOM.default);

  // Planner drawing refs
  const plannerWpSourceRef = useRef<VectorSource | null>(null);
  const plannerRouteSourceRef = useRef<VectorSource | null>(null);
  const plannerWpLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const plannerRouteLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const plannerModifyRef = useRef<Modify | null>(null);
  const plannerPropsRef = useRef(plannerProps);
  useEffect(() => { plannerPropsRef.current = plannerProps; }, [plannerProps]);
  const onActivityHoverRef = useRef(onActivityHover);
  useEffect(() => { onActivityHoverRef.current = onActivityHover; }, [onActivityHover]);
  const lastHoveredIdRef = useRef<string | null>(null);
  const onPhotoMarkerClickRef = useRef(onPhotoMarkerClick);
  useEffect(() => { onPhotoMarkerClickRef.current = onPhotoMarkerClick; }, [onPhotoMarkerClick]);
  const onWaypointClickRef = useRef(onWaypointClick);
  useEffect(() => { onWaypointClickRef.current = onWaypointClick; }, [onWaypointClick]);

  // Initialise map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    proj4.defs(OS_PROJECTION.code, OS_PROJECTION.proj4);
    register(proj4);

    const projection = getProjection(OS_PROJECTION.code)!;

    const hiResTileGrid = new TileGrid({
      resolutions: OS_PROJECTION.resolutions,
      origin: OS_PROJECTION.origin,
      minZoom: 8,
    });
    const overviewTileGrid = new TileGrid({
      resolutions: OS_PROJECTION.resolutions,
      origin: OS_PROJECTION.origin,
    });

    const topoLayer = new TileLayer({
      source: new XYZ({ url: TOPO_DARK_TILE_URL, maxZoom: 16 }),
      visible: true,
      zIndex: 0,
    });
    const osOverviewLayer = new TileLayer({
      source: new XYZ({ url: OS_DARK_TILE_URL, projection, tileGrid: overviewTileGrid }),
      maxZoom: 6,
      visible: false,
      zIndex: 0,
    });
    const os25kLayer = new TileLayer({
      source: new XYZ({ url: OS_DARK_TILE_URL, projection, tileGrid: hiResTileGrid }),
      minZoom: 6,
      visible: false,
      zIndex: 0,
    });
    const satelliteLayer = new TileLayer({
      source: new XYZ({ url: SATELLITE_TILE_URL, maxZoom: 18 }),
      visible: false,
      zIndex: 0,
    });

    const hillshadeLayer = new TileLayer({
      source: new XYZ({ url: HILLSHADE_TILE_URL, projection, tileGrid: overviewTileGrid }),
      opacity: 0.65,
      visible: false,
      zIndex: 5,
    });

    const routeSource = new VectorSource();
    const routeLayer = new VectorLayer({ source: routeSource, zIndex: 10 });

    // Selected route layer: full-opacity vivid styles, layer-level opacity for
    // genuine translucency. This avoids the compositing trap where semi-transparent
    // strokes stack and make the center look opaque/muddy.
    const selectedRouteSource = new VectorSource();
    const selectedRouteLayer = new VectorLayer({ source: selectedRouteSource, zIndex: 12, opacity: 0.68 });

    const photoSource = new VectorSource();
    const photoLayer = new VectorLayer({ source: photoSource, zIndex: 20 });

    // Planner layers (always present, toggled visible in planner mode)
    const plannerRouteSource = new VectorSource();
    const plannerRouteLayer = new VectorLayer({ source: plannerRouteSource, zIndex: 25, visible: false, opacity: 0.68 });
    const plannerWpSource = new VectorSource();
    const plannerWpLayer = new VectorLayer({ source: plannerWpSource, zIndex: 30, visible: false });

    // Planner Modify interaction (added/removed based on plannerProps)
    const plannerModify = new Modify({
      source: plannerWpSource,
      hitDetection: plannerWpLayer,
    });
    plannerModify.on('modifyend', (e) => {
      for (const feature of e.features.getArray()) {
        const index = feature.get('waypointIndex') as number;
        const geom = feature.getGeometry() as Point;
        const [lng, lat] = toLonLat(geom.getCoordinates(), OS_PROJECTION.code);
        plannerPropsRef.current?.dispatch({ type: 'MOVE_WAYPOINT', index, waypoint: { lat, lng } });
      }
    });

    topoLayerRef.current = topoLayer;
    osOverviewLayerRef.current = osOverviewLayer;
    os25kLayerRef.current = os25kLayer;
    satelliteLayerRef.current = satelliteLayer;
    hillshadeLayerRef.current = hillshadeLayer;
    routeSourceRef.current = routeSource;
    routeLayerRef.current = routeLayer;
    selectedRouteSourceRef.current = selectedRouteSource;
    selectedRouteLayerRef.current = selectedRouteLayer;
    photoSourceRef.current = photoSource;
    photoLayerRef.current = photoLayer;
    plannerWpSourceRef.current = plannerWpSource;
    plannerRouteSourceRef.current = plannerRouteSource;
    plannerWpLayerRef.current = plannerWpLayer;
    plannerRouteLayerRef.current = plannerRouteLayer;
    plannerModifyRef.current = plannerModify;

    const center = fromLonLat([OS_DEFAULT_CENTER.lng, OS_DEFAULT_CENTER.lat], OS_PROJECTION.code);
    const viewResolutions = [...OS_PROJECTION.resolutions, 0.875, 0.4375, 0.21875];

    const olMap = new Map({
      target: mapRef.current,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      layers: [topoLayer, osOverviewLayer, os25kLayer, satelliteLayer, hillshadeLayer, routeLayer, selectedRouteLayer, photoLayer, plannerRouteLayer, plannerWpLayer],
      view: new View({
        projection,
        center,
        zoom: OS_ZOOM.default,
        minZoom: OS_ZOOM.min,
        maxZoom: 12,
        resolutions: viewResolutions,
      }),
    });

    // Track zoom for zoom buttons
    olMap.getView().on('change:resolution', () => {
      setCurrentZoom(olMap.getView().getZoom() ?? OS_ZOOM.default);
    });

    mapInstanceRef.current = olMap;
    onMapReady?.(olMap);

    return () => {
      olMap.setTarget(undefined);
      mapInstanceRef.current = null;
      routeSourceRef.current = null;
      routeLayerRef.current = null;
      selectedRouteSourceRef.current = null;
      selectedRouteLayerRef.current = null;
      photoSourceRef.current = null;
      topoLayerRef.current = null;
      osOverviewLayerRef.current = null;
      os25kLayerRef.current = null;
      satelliteLayerRef.current = null;
      hillshadeLayerRef.current = null;
      photoLayerRef.current = null;
      plannerWpSourceRef.current = null;
      plannerRouteSourceRef.current = null;
      plannerWpLayerRef.current = null;
      plannerRouteLayerRef.current = null;
      plannerModifyRef.current = null;
      personalHeatmapLayerRef.current = null;
      fittedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle planner layers and Modify interaction
  useEffect(() => {
    const map = mapInstanceRef.current;
    const active = !!plannerProps;
    plannerWpLayerRef.current?.setVisible(active);
    plannerRouteLayerRef.current?.setVisible(active);
    if (map && plannerModifyRef.current) {
      if (active) map.addInteraction(plannerModifyRef.current);
      else map.removeInteraction(plannerModifyRef.current);
    }
  }, [!!plannerProps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync planner features
  useEffect(() => {
    if (!plannerProps || !plannerWpSourceRef.current || !plannerRouteSourceRef.current) return;
    syncPlannerFeatures(
      plannerWpSourceRef.current,
      plannerRouteSourceRef.current,
      plannerProps.waypoints,
      plannerProps.segments,
    );
  }, [plannerProps?.waypoints, plannerProps?.segments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag-to-insert on route segments (planner mode only)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !plannerProps) return;

    const dragInsertStyle = new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: 'rgba(14,40,48,0.5)' }),
        stroke: new Stroke({ color: '#E07020', width: 2 }),
      }),
    });

    let dragInsertSegIdx: number | null = null;
    let dragInsertSnapped = false;
    let dragInsertFeature: Feature | null = null;
    let dragInsertMoved = false;

    const viewport = map.getViewport();

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const pixel = map.getEventPixel(e);
      const wpHit = map.forEachFeatureAtPixel(pixel, () => true, {
        layerFilter: (l) => l === plannerWpLayerRef.current, hitTolerance: 12,
      });
      if (wpHit) return;
      const routeFeature = map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (l) => l === plannerRouteLayerRef.current, hitTolerance: 10,
      });
      if (!routeFeature) return;

      dragInsertSegIdx = routeFeature.get('segmentIndex') as number;
      dragInsertSnapped = routeFeature.get('snapped') as boolean;
      dragInsertMoved = false;

      const coord = map.getCoordinateFromPixel(pixel);
      dragInsertFeature = new Feature({ geometry: new Point(coord) });
      dragInsertFeature.setStyle(dragInsertStyle);
      plannerWpSourceRef.current?.addFeature(dragInsertFeature);

      map.getInteractions().forEach((i) => { if (i instanceof DragPan) i.setActive(false); });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragInsertSegIdx === null || !dragInsertFeature) return;
      if (!e.buttons) {
        plannerWpSourceRef.current?.removeFeature(dragInsertFeature);
        dragInsertFeature = null;
        dragInsertSegIdx = null;
        map.getInteractions().forEach((i) => { if (i instanceof DragPan) i.setActive(true); });
        return;
      }
      dragInsertMoved = true;
      const coord = map.getCoordinateFromPixel(map.getEventPixel(e));
      (dragInsertFeature.getGeometry() as Point).setCoordinates(coord);
    };

    const onPointerUp = () => {
      if (dragInsertSegIdx === null) return;
      map.getInteractions().forEach((i) => { if (i instanceof DragPan) i.setActive(true); });
      const coord = dragInsertFeature
        ? (dragInsertFeature.getGeometry() as Point).getCoordinates()
        : null;
      if (dragInsertFeature) {
        plannerWpSourceRef.current?.removeFeature(dragInsertFeature);
        dragInsertFeature = null;
      }
      const segIdx = dragInsertSegIdx;
      const isSnapped = dragInsertSnapped;
      const moved = dragInsertMoved;
      dragInsertSegIdx = null;
      if (!moved || !coord) return;
      const [lng, lat] = toLonLat(coord, OS_PROJECTION.code);
      plannerPropsRef.current?.dispatch({ type: 'INSERT_WAYPOINT', index: segIdx + 1, waypoint: { lat, lng }, snap: isSnapped });
    };

    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);

    return () => {
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
    };
  }, [!!plannerProps]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync tile layer visibility when baseLayer prop changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const isSat = baseLayer === 'satellite';
    topoLayerRef.current?.setVisible(!isSat);
    osOverviewLayerRef.current?.setVisible(!isSat);
    os25kLayerRef.current?.setVisible(!isSat);
    satelliteLayerRef.current?.setVisible(isSat);
  }, [baseLayer]);

  // Swap OS tile URLs when dark/light theme changes
  useEffect(() => {
    const topoSrc = topoLayerRef.current?.getSource() as XYZ | null;
    const ovSrc = osOverviewLayerRef.current?.getSource() as XYZ | null;
    const hkSrc = os25kLayerRef.current?.getSource() as XYZ | null;
    if (topoSrc) { topoSrc.setUrl(osDark ? TOPO_DARK_TILE_URL : TOPO_TILE_URL); topoSrc.refresh(); }
    if (ovSrc) { ovSrc.setUrl(osDark ? OS_DARK_TILE_URL : OS_TILE_URL); ovSrc.refresh(); }
    if (hkSrc) { hkSrc.setUrl(osDark ? OS_DARK_TILE_URL : OS_TILE_URL); hkSrc.refresh(); }
  }, [osDark]);

  // Hillshade visibility
  useEffect(() => {
    hillshadeLayerRef.current?.setVisible(showHillshade);
  }, [showHillshade]);

  // Photo markers visibility
  useEffect(() => {
    photoLayerRef.current?.setVisible(showPhotos);
  }, [showPhotos]);

  // Dim base map — reduce opacity of topo/OS layers
  useEffect(() => {
    const opacity = dimBaseMap ? 0.45 : 1;
    topoLayerRef.current?.setOpacity(opacity);
    osOverviewLayerRef.current?.setOpacity(opacity);
    os25kLayerRef.current?.setOpacity(opacity);
  }, [dimBaseMap]);

  // Personal heatmap — MVT vector tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (personalHeatmapLayerRef.current) {
      map.removeLayer(personalHeatmapLayerRef.current);
      personalHeatmapLayerRef.current = null;
    }

    if (!showPersonalHeatmap) return;

    const layer = new OlVectorTileLayer({
      source: new OlVectorTileSource({
        format: new MVT(),
        url: '/api/tiles/{z}/{x}/{y}',
        maxZoom: 14,
      }),
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(140, 40, 220, 0.55)',
          width: 2,
        }),
      }),
      zIndex: 6,
    });

    map.addLayer(layer);
    personalHeatmapLayerRef.current = layer;

    return () => {
      if (personalHeatmapLayerRef.current) {
        map.removeLayer(personalHeatmapLayerRef.current);
        personalHeatmapLayerRef.current = null;
      }
    };
  }, [showPersonalHeatmap]);

  // Sync activity route features (dim in planner mode)
  useEffect(() => {
    const source = routeSourceRef.current;
    const selectedSource = selectedRouteSourceRef.current;
    const map = mapInstanceRef.current;
    if (!source) return;

    source.clear();
    selectedSource?.clear();
    const withRoutes = activities.filter((a) => a.route && a.route.length > 1);
    const inPlanner = !!plannerProps;

    for (const activity of withRoutes) {
      if (!showRecentActivities && !inPlanner && String(activity.id) !== selectedId) continue;
      const id = String(activity.id);
      const coords = activity.route!.map(([lat, lng]) =>
        fromLonLat([lng, lat], OS_PROJECTION.code)
      );
      const color = getActivityColor(activity.type);
      const [r, g, b] = hexToComponents(color);
      const isSelected = !!selectedId && selectedId === id;

      if (isSelected && selectedSource) {
        // Selected route goes in its own layer (opacity 0.68) with full-saturation
        // styles. Layer-level opacity is the only way to get a genuinely translucent
        // centre without the compositing-makes-it-opaque problem.
        const routeFeature = new Feature({ geometry: new LineString(coords), activityId: id });
        routeFeature.setStyle([
          new Style({ stroke: new Stroke({ color: 'rgba(7,14,20,1)', width: 16 }) }),
          new Style({ stroke: new Stroke({ color: `rgba(${r},${g},${b},1)`, width: 11 }) }),
        ]);
        selectedSource.addFeature(routeFeature);

        // Start marker
        const startFeature = new Feature({ geometry: new Point(coords[0]) });
        startFeature.setStyle(new Style({
          image: new CircleStyle({
            radius: 7,
            fill: new Fill({ color: `rgb(${r},${g},${b})` }),
            stroke: new Stroke({ color: 'rgb(240,248,250)', width: 2.5 }),
          }),
          zIndex: 20,
        }));
        selectedSource.addFeature(startFeature);

        // End marker (checkered circle)
        const endSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><defs><clipPath id="ec"><circle cx="8" cy="8" r="6"/></clipPath></defs><g clip-path="url(#ec)"><rect x="2" y="2" width="6" height="6" fill="${color}"/><rect x="8" y="2" width="6" height="6" fill="white"/><rect x="2" y="8" width="6" height="6" fill="white"/><rect x="8" y="8" width="6" height="6" fill="${color}"/></g><circle cx="8" cy="8" r="6" fill="none" stroke="rgb(240,248,250)" stroke-width="2"/></svg>`;
        const endFeature = new Feature({ geometry: new Point(coords[coords.length - 1]) });
        endFeature.setStyle(new Style({
          image: new Icon({ src: `data:image/svg+xml;utf8,${encodeURIComponent(endSvg)}`, scale: 1 }),
          zIndex: 20,
        }));
        selectedSource.addFeature(endFeature);

        // Also add a ghost to routeSource so click-hit-testing still works
        const ghost = new Feature({ geometry: new LineString(coords), activityId: id });
        ghost.setStyle(new Style({ stroke: new Stroke({ color: 'rgba(0,0,0,0)', width: 11 }) }));
        source.addFeature(ghost);
      } else {
        const isHovered = !isSelected && !!highlightedId && highlightedId === id;
        const defaultAlpha = osDark ? 0.35 : 0.45;
        const alpha = inPlanner
          ? (loadedActivityId === id ? 0.55 : 0.08)
          : selectedId
            ? 0.08
            : isHovered
              ? 0.65
              : highlightedId
                ? 0.12
                : defaultAlpha;
        const feature = new Feature({ geometry: new LineString(coords), activityId: id });
        feature.setStyle(routeStyles(color, alpha));
        source.addFeature(feature);
      }
    }

    if (!fittedRef.current && !inPlanner && withRoutes.length > 0 && map) {
      // If an activity is pre-selected (e.g. loaded via URL), fit to it.
      // Otherwise fit to the 3 most recent to avoid European activities
      // pulling the extent centre far outside the UK.
      const selectedActivity = selectedId ? withRoutes.find(a => String(a.id) === selectedId) : null;
      const fitActivities = selectedActivity
        ? [selectedActivity]
        : [...withRoutes].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')).slice(0, 3);
      const fitCoords = fitActivities.flatMap(a =>
        a.route!.map(([lat, lng]) => fromLonLat([lng, lat], OS_PROJECTION.code))
      );
      const extent = fitCoords.length > 0 ? boundingExtent(fitCoords) : source.getExtent();
      if (isFinite(extent[0])) {
        map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 9, duration: 400 });
        fittedRef.current = true;
        // Clamp minimum zoom — prevents "whole of UK" view for very spread extents
        const fitMap = map;
        setTimeout(() => {
          const z = fitMap.getView().getZoom() ?? 6;
          if (z < 6) fitMap.getView().animate({ center: getCenter(extent), zoom: 6, duration: 200 });
        }, 450);
      }
    }
  }, [activities, highlightedId, selectedId, showRecentActivities, !!plannerProps, osDark, loadedActivityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync photo pin markers
  useEffect(() => {
    const source = photoSourceRef.current;
    if (!source) return;
    source.clear();
    if (!photoMarkers?.length) return;

    for (const photo of photoMarkers) {
      if (!photo.lat && !photo.lng) continue;
      const coord = fromLonLat([photo.lng, photo.lat], OS_PROJECTION.code);
      const feature = new Feature({
        geometry: new Point(coord),
        photoId: photo.id,
        photoUrl: photo.url,
        photoCaption: photo.caption,
      });
      feature.setStyle(new Style({
        image: new Icon({
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinIconSvg(true))}`,
          anchor: [0.5, 1],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
        }),
      }));
      source.addFeature(feature);
    }
  }, [photoMarkers]);

  // Click handler — planner adds waypoints, browse selects activities
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onClick = (e: any) => {
      const pp = plannerPropsRef.current;
      if (pp) {
        // In planner mode: check for waypoint hit (open popover) otherwise add
        const wpFeature = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
          layerFilter: (l) => l === plannerWpLayerRef.current,
          hitTolerance: 12,
        });
        if (wpFeature) {
          onWaypointClickRef.current?.({
            index: wpFeature.get('waypointIndex'),
            screenX: e.originalEvent.clientX,
            screenY: e.originalEvent.clientY,
          });
          return;
        }
        const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
        pp.dispatch({ type: 'ADD_WAYPOINT', waypoint: { lat, lng }, snap: true });
        return;
      }
      // Browse mode: check photo pins first, then activity traces
      let handled = false;
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        if (handled) return;
        const photoId = feature.get('photoId');
        if (photoId) {
          onPhotoMarkerClickRef.current?.(photoId);
          handled = true;
        }
      }, { layerFilter: (l) => l === photoLayerRef.current, hitTolerance: 8 });
      if (handled) return;
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        const actId = feature.get('activityId');
        if (actId && onActivitySelect) onActivitySelect(actId);
      });
    };

    map.on('click', onClick);
    return () => map.un('click', onClick);
  }, [onActivitySelect]);

  // Cursor — crosshair in planner mode, pointer on activity hover in browse mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMove = (e: any) => {
      const el = map.getTargetElement() as HTMLElement;
      if (plannerPropsRef.current) {
        const wpHit = map.hasFeatureAtPixel(e.pixel, {
          layerFilter: (l) => l === plannerWpLayerRef.current,
          hitTolerance: 10,
        });
        const routeHit = !wpHit && map.hasFeatureAtPixel(e.pixel, {
          layerFilter: (l) => l === plannerRouteLayerRef.current,
          hitTolerance: 10,
        });
        el.style.cursor = wpHit ? 'move' : routeHit ? 'copy' : 'crosshair';
        if (lastHoveredIdRef.current !== null) {
          lastHoveredIdRef.current = null;
          onActivityHoverRef.current?.(null);
        }
        return;
      }
      // Browse mode — detect trace hover
      let hoveredId: string | null = null;
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        hoveredId = feature.get('activityId') ?? null;
      }, { layerFilter: (l) => l === routeLayerRef.current });
      el.style.cursor = hoveredId ? 'pointer' : '';
      if (hoveredId !== lastHoveredIdRef.current) {
        lastHoveredIdRef.current = hoveredId;
        onActivityHoverRef.current?.(hoveredId);
      }
    };

    map.on('pointermove', onMove);
    return () => map.un('pointermove', onMove);
  }, []);

  function handleZoomIn() {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    const zoom = view.getZoom() ?? OS_ZOOM.default;
    view.animate({ zoom: Math.min(zoom + 1, 12), duration: 200 });
  }

  function handleZoomOut() {
    const map = mapInstanceRef.current;
    if (!map) return;
    const view = map.getView();
    const zoom = view.getZoom() ?? OS_ZOOM.default;
    view.animate({ zoom: Math.max(zoom - 1, OS_ZOOM.min), duration: 200 });
  }

  const zoomBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 6,
    background: 'var(--glass)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid var(--p3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? 'var(--fog-ghost)' : 'var(--fog)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    padding: 0,
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Zoom buttons — top right */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <button
          onClick={handleZoomIn}
          disabled={currentZoom >= 12}
          aria-label="Zoom in"
          style={zoomBtnStyle(currentZoom >= 12)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          disabled={currentZoom <= OS_ZOOM.min}
          aria-label="Zoom out"
          style={zoomBtnStyle(currentZoom <= OS_ZOOM.min)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
