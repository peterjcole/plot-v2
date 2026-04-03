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
import { Style, Stroke } from 'ol/style';
import { get as getProjection, fromLonLat } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { OS_PROJECTION, OS_DARK_TILE_URL, OS_DEFAULT_CENTER, OS_ZOOM } from '@/lib/map-config';
import { ActivitySummary } from '@/lib/types';
import { getActivityColor } from '@/lib/activity-categories';
import 'ol/ol.css';

interface MainMapProps {
  activities: ActivitySummary[];
  highlightedId?: string | null;
  onActivitySelect?: (id: string) => void;
}

function hexToComponents(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function routeStyles(color: string, alpha: number): Style[] {
  const [r, g, b] = hexToComponents(color);
  return [
    new Style({ stroke: new Stroke({ color: `rgba(${r},${g},${b},${alpha})`, width: 5 }) }),
    new Style({ stroke: new Stroke({ color: `rgba(7,14,20,${alpha * 0.6})`, width: 2 }) }),
  ];
}

export default function MainMap({ activities, highlightedId, onActivitySelect }: MainMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const routeLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const fittedRef = useRef(false);

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

    const osOverviewLayer = new TileLayer({
      source: new XYZ({ url: OS_DARK_TILE_URL, projection, tileGrid: overviewTileGrid }),
      maxZoom: 6,
    });
    const os25kLayer = new TileLayer({
      source: new XYZ({ url: OS_DARK_TILE_URL, projection, tileGrid: hiResTileGrid }),
      minZoom: 6,
    });

    const routeSource = new VectorSource();
    const routeLayer = new VectorLayer({ source: routeSource, zIndex: 10 });

    routeSourceRef.current = routeSource;
    routeLayerRef.current = routeLayer;

    const center = fromLonLat([OS_DEFAULT_CENTER.lng, OS_DEFAULT_CENTER.lat], OS_PROJECTION.code);
    const viewResolutions = [...OS_PROJECTION.resolutions, 0.875, 0.4375, 0.21875];

    const olMap = new Map({
      target: mapRef.current,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      layers: [osOverviewLayer, os25kLayer, routeLayer],
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

    return () => {
      olMap.setTarget(undefined);
      mapInstanceRef.current = null;
      routeSourceRef.current = null;
      routeLayerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Sync route features when activities or highlight changes
  useEffect(() => {
    const source = routeSourceRef.current;
    const map = mapInstanceRef.current;
    if (!source) return;

    source.clear();

    const withRoutes = activities.filter((a) => a.route && a.route.length > 1);

    for (const activity of withRoutes) {
      const id = String(activity.id);
      const coords = activity.route!.map(([lat, lng]) =>
        fromLonLat([lng, lat], OS_PROJECTION.code)
      );
      const feature = new Feature({ geometry: new LineString(coords), activityId: id });
      const color = getActivityColor(activity.type);
      const alpha = highlightedId
        ? highlightedId === id ? 0.9 : 0.1
        : 0.28;
      feature.setStyle(routeStyles(color, alpha));
      source.addFeature(feature);
    }

    // Fit to all routes on first load only
    if (!fittedRef.current && withRoutes.length > 0 && map) {
      const extent = source.getExtent();
      if (isFinite(extent[0])) {
        map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 9, duration: 400 });
        fittedRef.current = true;
      }
    }
  }, [activities, highlightedId]);

  // Click handler
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !onActivitySelect) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onClick = (e: any) => {
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        const id = feature.get('activityId');
        if (id) { onActivitySelect(id); return true; }
      }, { layerFilter: (l) => l === routeLayerRef.current });
    };

    map.on('click', onClick);
    return () => map.un('click', onClick);
  }, [onActivitySelect]);

  // Pointer cursor on hover
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMove = (e: any) => {
      const hit = map.hasFeatureAtPixel(e.pixel, {
        layerFilter: (l) => l === routeLayerRef.current,
      });
      (map.getTargetElement() as HTMLElement).style.cursor = hit ? 'pointer' : '';
    };

    map.on('pointermove', onMove);
    return () => map.un('pointermove', onMove);
  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
