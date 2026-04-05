'use client';

import { useRef, useEffect } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import TileGrid from 'ol/tilegrid/TileGrid';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Style, Stroke, Icon } from 'ol/style';
import { Modify } from 'ol/interaction';
import { get as getProjection, fromLonLat, toLonLat } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import {
  OS_PROJECTION, OS_TILE_URL, OS_DARK_TILE_URL, TOPO_TILE_URL, TOPO_DARK_TILE_URL, SATELLITE_TILE_URL,
  OS_DEFAULT_CENTER, OS_ZOOM,
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

interface MainMapProps {
  activities: ActivitySummary[];
  highlightedId?: string | null;
  photoMarkers?: ActivityPhoto[];
  onActivitySelect?: (id: string) => void;
  baseLayer?: MapLayer;
  onBaseLayerChange?: (layer: MapLayer) => void;
  plannerProps?: PlannerProps;
  onMapReady?: (map: Map) => void;
  osDark?: boolean;
}

// ── Activity trace styles ────────────────────────────────────────────────────

function hexToComponents(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function routeStyles(color: string, alpha: number, isDark = true): Style[] {
  const [r, g, b] = hexToComponents(color);
  const overlay = isDark ? `rgba(7,14,20,${alpha * 0.6})` : 'rgba(255,255,255,0.30)';
  return [
    new Style({ stroke: new Stroke({ color: `rgba(${r},${g},${b},${alpha})`, width: 5 }) }),
    new Style({ stroke: new Stroke({ color: overlay, width: 2 }) }),
  ];
}

function pinIconSvg(hasPhoto: boolean): string {
  const fill = hasPhoto ? '#E07020' : '#2A5860';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <path d="M10 27c-2-6-9-11-9-17a9 9 0 1 1 18 0c0 6-7 11-9 17Z" fill="${fill}" stroke="rgba(240,248,250,0.6)" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="3.5" fill="rgba(240,248,250,0.9)"/>
  </svg>`;
}

// ── Planner drawing styles ───────────────────────────────────────────────────

const snappedRouteStyle = [
  new Style({ stroke: new Stroke({ color: '#3A4722', width: 16 }) }),
  new Style({ stroke: new Stroke({ color: '#A8C476', width: 10 }) }),
];
const unsnappedRouteStyle = [
  new Style({ stroke: new Stroke({ color: '#3A4722', width: 13, lineDash: [12, 14] }) }),
  new Style({ stroke: new Stroke({ color: '#A8C476', width: 8, lineDash: [12, 14] }) }),
];
const routingPendingStyle = [
  new Style({ stroke: new Stroke({ color: '#3A4722', width: 10, lineDash: [2, 6] }) }),
  new Style({ stroke: new Stroke({ color: '#A8C476', width: 6, lineDash: [2, 6] }) }),
];

function waypointPinSvg(index: number): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">' +
    '<path d="M16 44c-3-10-14-18-14-28a14 14 0 1 1 28 0c0 10-11 18-14 28Z" ' +
    'fill="rgba(74,90,43,0.85)" stroke="rgba(255,255,255,0.75)" stroke-width="2.5"/>' +
    '<text x="16" y="15" text-anchor="middle" dominant-baseline="central" ' +
    `fill="rgba(255,255,255,0.95)" font-size="13" font-weight="bold" font-family="sans-serif">${index + 1}</text>` +
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
  photoMarkers,
  onActivitySelect,
  baseLayer = 'topo',
  onBaseLayerChange,
  plannerProps,
  onMapReady,
  osDark = true,
}: MainMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const routeLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const photoSourceRef = useRef<VectorSource | null>(null);
  const topoLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const osOverviewLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const os25kLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const satelliteLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const fittedRef = useRef(false);

  // Planner drawing refs
  const plannerWpSourceRef = useRef<VectorSource | null>(null);
  const plannerRouteSourceRef = useRef<VectorSource | null>(null);
  const plannerWpLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const plannerRouteLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const plannerModifyRef = useRef<Modify | null>(null);
  const plannerPropsRef = useRef(plannerProps);
  useEffect(() => { plannerPropsRef.current = plannerProps; }, [plannerProps]);

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

    const routeSource = new VectorSource();
    const routeLayer = new VectorLayer({ source: routeSource, zIndex: 10 });

    const photoSource = new VectorSource();
    const photoLayer = new VectorLayer({ source: photoSource, zIndex: 20 });

    // Planner layers (always present, toggled visible in planner mode)
    const plannerRouteSource = new VectorSource();
    const plannerRouteLayer = new VectorLayer({ source: plannerRouteSource, zIndex: 25, visible: false });
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
    routeSourceRef.current = routeSource;
    routeLayerRef.current = routeLayer;
    photoSourceRef.current = photoSource;
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
      layers: [topoLayer, osOverviewLayer, os25kLayer, satelliteLayer, routeLayer, photoLayer, plannerRouteLayer, plannerWpLayer],
      view: new View({
        projection,
        center,
        zoom: OS_ZOOM.default,
        minZoom: OS_ZOOM.min,
        maxZoom: 12,
        resolutions: viewResolutions,
      }),
    });

    mapInstanceRef.current = olMap;
    onMapReady?.(olMap);

    return () => {
      olMap.setTarget(undefined);
      mapInstanceRef.current = null;
      routeSourceRef.current = null;
      routeLayerRef.current = null;
      photoSourceRef.current = null;
      topoLayerRef.current = null;
      osOverviewLayerRef.current = null;
      os25kLayerRef.current = null;
      satelliteLayerRef.current = null;
      plannerWpSourceRef.current = null;
      plannerRouteSourceRef.current = null;
      plannerWpLayerRef.current = null;
      plannerRouteLayerRef.current = null;
      plannerModifyRef.current = null;
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
    const topoSrc = topoLayerRef.current?.getSource();
    const ovSrc = osOverviewLayerRef.current?.getSource();
    const hkSrc = os25kLayerRef.current?.getSource();
    if (topoSrc) (topoSrc as XYZ).setUrl(osDark ? TOPO_DARK_TILE_URL : TOPO_TILE_URL);
    if (ovSrc) (ovSrc as XYZ).setUrl(osDark ? OS_DARK_TILE_URL : OS_TILE_URL);
    if (hkSrc) (hkSrc as XYZ).setUrl(osDark ? OS_DARK_TILE_URL : OS_TILE_URL);
  }, [osDark]);

  // Sync activity route features (dim in planner mode)
  useEffect(() => {
    const source = routeSourceRef.current;
    const map = mapInstanceRef.current;
    if (!source) return;

    source.clear();
    const withRoutes = activities.filter((a) => a.route && a.route.length > 1);
    const inPlanner = !!plannerProps;

    for (const activity of withRoutes) {
      const id = String(activity.id);
      const coords = activity.route!.map(([lat, lng]) =>
        fromLonLat([lng, lat], OS_PROJECTION.code)
      );
      const feature = new Feature({ geometry: new LineString(coords), activityId: id });
      const color = getActivityColor(activity.type);
      const defaultAlpha = osDark ? 0.28 : 0.55;
      const alpha = inPlanner
        ? 0.08
        : highlightedId
          ? highlightedId === id ? 0.9 : 0.1
          : defaultAlpha;
      feature.setStyle(routeStyles(color, alpha, osDark));
      source.addFeature(feature);
    }

    if (!fittedRef.current && !inPlanner && withRoutes.length > 0 && map) {
      const extent = source.getExtent();
      if (isFinite(extent[0])) {
        map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 9, duration: 400 });
        fittedRef.current = true;
      }
    }
  }, [activities, highlightedId, !!plannerProps, osDark]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // In planner mode: check for waypoint hit (skip adding) otherwise add
        const wpHit = map.forEachFeatureAtPixel(e.pixel, () => true, {
          layerFilter: (l) => l === plannerWpLayerRef.current,
          hitTolerance: 10,
        });
        if (wpHit) return;
        const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
        pp.dispatch({ type: 'ADD_WAYPOINT', waypoint: { lat, lng }, snap: true });
        return;
      }
      // Browse mode: select activity
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
        el.style.cursor = wpHit ? 'move' : 'crosshair';
        return;
      }
      const hit = map.hasFeatureAtPixel(e.pixel, {
        layerFilter: (l) => l === routeLayerRef.current,
      });
      el.style.cursor = hit ? 'pointer' : '';
    };

    map.on('pointermove', onMove);
    return () => map.un('pointermove', onMove);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
