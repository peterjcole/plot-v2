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
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Style, Stroke, Icon } from 'ol/style';
import { get as getProjection, fromLonLat } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import {
  OS_PROJECTION, OS_DARK_TILE_URL, TOPO_DARK_TILE_URL, SATELLITE_TILE_URL,
  OS_DEFAULT_CENTER, OS_ZOOM,
} from '@/lib/map-config';
import { ActivitySummary, ActivityPhoto } from '@/lib/types';
import { getActivityColor } from '@/lib/activity-categories';
import 'ol/ol.css';

export type MapLayer = 'topo' | 'os' | 'satellite';

interface MainMapProps {
  activities: ActivitySummary[];
  highlightedId?: string | null;
  photoMarkers?: ActivityPhoto[];
  onActivitySelect?: (id: string) => void;
  baseLayer?: MapLayer;
  onBaseLayerChange?: (layer: MapLayer) => void;
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

function pinIconSvg(hasPhoto: boolean): string {
  const fill = hasPhoto ? '#E07020' : '#2A5860';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <path d="M10 27c-2-6-9-11-9-17a9 9 0 1 1 18 0c0 6-7 11-9 17Z" fill="${fill}" stroke="rgba(240,248,250,0.6)" stroke-width="1.5"/>
    <circle cx="10" cy="10" r="3.5" fill="rgba(240,248,250,0.9)"/>
  </svg>`;
}

export default function MainMap({
  activities,
  highlightedId,
  photoMarkers,
  onActivitySelect,
  baseLayer = 'topo',
  onBaseLayerChange,
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

    // Topo (default, worldwide)
    const topoLayer = new TileLayer({
      source: new XYZ({ url: TOPO_DARK_TILE_URL, maxZoom: 16 }),
      visible: true,
      zIndex: 0,
    });

    // OS overview tiles (UK only, EPSG:27700)
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

    // Satellite
    const satelliteLayer = new TileLayer({
      source: new XYZ({ url: SATELLITE_TILE_URL, maxZoom: 18 }),
      visible: false,
      zIndex: 0,
    });

    const routeSource = new VectorSource();
    const routeLayer = new VectorLayer({ source: routeSource, zIndex: 10 });

    const photoSource = new VectorSource();
    const photoLayer = new VectorLayer({ source: photoSource, zIndex: 20 });

    topoLayerRef.current = topoLayer;
    osOverviewLayerRef.current = osOverviewLayer;
    os25kLayerRef.current = os25kLayer;
    satelliteLayerRef.current = satelliteLayer;
    routeSourceRef.current = routeSource;
    routeLayerRef.current = routeLayer;
    photoSourceRef.current = photoSource;

    const center = fromLonLat([OS_DEFAULT_CENTER.lng, OS_DEFAULT_CENTER.lat], OS_PROJECTION.code);
    const viewResolutions = [...OS_PROJECTION.resolutions, 0.875, 0.4375, 0.21875];

    const olMap = new Map({
      target: mapRef.current,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      layers: [topoLayer, osOverviewLayer, os25kLayer, satelliteLayer, routeLayer, photoLayer],
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
      photoSourceRef.current = null;
      topoLayerRef.current = null;
      osOverviewLayerRef.current = null;
      os25kLayerRef.current = null;
      satelliteLayerRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Sync tile layer visibility when baseLayer prop changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const isTopo = baseLayer === 'topo';
    const isOS = baseLayer === 'os';
    const isSat = baseLayer === 'satellite';
    topoLayerRef.current?.setVisible(isTopo);
    osOverviewLayerRef.current?.setVisible(isOS);
    os25kLayerRef.current?.setVisible(isOS);
    satelliteLayerRef.current?.setVisible(isSat);
  }, [baseLayer]);

  // Sync route features
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

    if (!fittedRef.current && withRoutes.length > 0 && map) {
      const extent = source.getExtent();
      if (isFinite(extent[0])) {
        map.getView().fit(extent, { padding: [40, 40, 40, 40], maxZoom: 9, duration: 400 });
        fittedRef.current = true;
      }
    }
  }, [activities, highlightedId]);

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

  // Click handler — routes and photo pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onClick = (e: any) => {
      let handled = false;
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        if (handled) return;
        const actId = feature.get('activityId');
        if (actId && onActivitySelect) { onActivitySelect(actId); handled = true; }
      });
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Layer toggle */}
      {onBaseLayerChange && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 100,
        }}>
          {(['topo', 'os', 'satellite'] as MapLayer[]).map((l) => (
            <button
              key={l}
              onClick={() => onBaseLayerChange(l)}
              title={l === 'topo' ? 'Topo' : l === 'os' ? 'OS (UK)' : 'Satellite'}
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
              {l === 'topo' ? 'T' : l === 'os' ? 'OS' : 'S'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
