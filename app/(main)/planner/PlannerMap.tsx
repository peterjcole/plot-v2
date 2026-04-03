'use client';

import { useRef, useEffect, useCallback } from 'react';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Circle as CircleStyle, Fill, Stroke, Icon, Text } from 'ol/style';
import Supercluster from 'supercluster';
import { DragPan, Modify } from 'ol/interaction';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import OlVectorTileLayer from 'ol/layer/VectorTile';
import OlVectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { useOpenLayersMap } from './useOpenLayersMap';
import { RouteAction } from './useRouteHistory';
import { Waypoint, RouteSegment, PhotoItem } from '@/lib/types';
import { OS_PROJECTION, OS_TILE_URL, OS_DARK_TILE_URL, TOPO_TILE_URL, TOPO_DARK_TILE_URL, type BaseMap } from '@/lib/map-config';
import { DEFAULT_SPORT_COLOR, hexToRgba } from '@/lib/sport-colors';


interface PlannerMapProps {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  dispatch: React.Dispatch<RouteAction>;
  onMapReady?: (map: Map) => void;
  addPointsEnabled: boolean;
  snapEnabled: boolean;
  baseMap: BaseMap;
  osDark?: boolean;
  heatmapEnabled: boolean;
  heatmapSport: string;
  heatmapColor: string;
  dimBaseMap: boolean;
  personalHeatmapEnabled: boolean;
  explorerEnabled: boolean;
  explorerFilter: string;
  hoveredElevationPoint?: { lat: number; lng: number; ele: number; distance: number } | null;
  hillshadeEnabled: boolean;
  poisEnabled: boolean;
  photosEnabled: boolean;
  onHeatmapClick?: (lat: number, lng: number, screenX: number, screenY: number) => void;
  onPhotoClick?: (photo: PhotoItem, screenX: number, screenY: number) => void;
  onClusterPhotosClick?: (photos: PhotoItem[], screenX: number, screenY: number) => void;
  onCloseActivityPopup?: () => void;
  hoveredActivityRoute?: [number, number][] | null;
  hoveredActivityColor?: string | null;
}

function pinSvg(index: number): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">' +
    '<path d="M16 44c-3-10-14-18-14-28a14 14 0 1 1 28 0c0 10-11 18-14 28Z" ' +
    'fill="rgba(74,90,43,0.7)" stroke="rgba(255,255,255,0.75)" stroke-width="2.5"/>' +
    '<text x="16" y="15" text-anchor="middle" dominant-baseline="central" ' +
    `fill="rgba(255,255,255,0.95)" font-size="13" font-weight="bold" font-family="sans-serif">${index + 1}</text>` +
    '</svg>'
  );
}

function waypointStyle(index: number) {
  return new Style({
    image: new Icon({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(index))}`,
      anchor: [0.5, 1],
      anchorXUnits: 'fraction',
      anchorYUnits: 'fraction',
    }),
  });
}

// Route styles: cased lines — opaque outline + lighter translucent fill, layer opacity on top.
// Matches ActivityMap look: translucent fill (0.35) with a dark outline (0.85).
// Layer opacity is 1 — transparency is per-stroke so the fill doesn't mask the outline.
// Cased lines: opaque outline + opaque lighter fill. The fill fully covers the outline
// centre so only the border edges remain. Layer opacity (0.45) makes the whole thing translucent.
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

// Temporary style during waypoint drag
const dragTempStyle = [
  new Style({ stroke: new Stroke({ color: '#3A4722', width: 10, lineDash: [6, 8] }) }),
  new Style({ stroke: new Stroke({ color: '#A8C476', width: 6, lineDash: [6, 8] }) }),
];

function distToSegment(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return Math.hypot(p[0] - projX, p[1] - projY);
}

function findInsertionIndex(tapCoord: number[], waypoints: Waypoint[]): number {
  if (waypoints.length < 2) return waypoints.length;
  let bestDist = Infinity;
  let bestIdx = 1;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = fromLonLat([waypoints[i].lng, waypoints[i].lat], OS_PROJECTION.code);
    const b = fromLonLat([waypoints[i + 1].lng, waypoints[i + 1].lat], OS_PROJECTION.code);
    const d = distToSegment(tapCoord, a, b);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i + 1;
    }
  }
  return bestIdx;
}

function syncFeatures(
  waypointSource: VectorSource | null,
  routeSource: VectorSource | null,
  waypoints: Waypoint[],
  segments: RouteSegment[]
) {
  if (!waypointSource || !routeSource) return;

  waypointSource.clear();
  waypoints.forEach((wp, i) => {
    const coord = fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code);
    const feature = new Feature({
      geometry: new Point(coord),
      waypointIndex: i,
    });
    feature.setStyle(waypointStyle(i));
    waypointSource.addFeature(feature);
  });

  routeSource.clear();
  if (waypoints.length >= 2) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const seg = segments[i];
      let coords: number[][];

      if (seg && seg.coordinates.length >= 2) {
        // Use routed coordinates
        coords = seg.coordinates.map((wp) =>
          fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
        );
      } else {
        // Straight line between waypoints
        coords = [
          fromLonLat([waypoints[i].lng, waypoints[i].lat], OS_PROJECTION.code),
          fromLonLat([waypoints[i + 1].lng, waypoints[i + 1].lat], OS_PROJECTION.code),
        ];
      }

      const lineFeature = new Feature({
        geometry: new LineString(coords),
        segmentIndex: i,
        snapped: seg?.snapped ?? false,
      });

      // Style based on segment state
      if (seg?.snapped && seg.coordinates.length >= 2) {
        lineFeature.setStyle(snappedRouteStyle);
      } else if (seg?.snapped && seg.coordinates.length === 0) {
        lineFeature.setStyle(routingPendingStyle);
      } else {
        lineFeature.setStyle(unsnappedRouteStyle);
      }

      routeSource.addFeature(lineFeature);
    }
  }
}

export default function PlannerMap({
  waypoints,
  segments,
  dispatch,
  onMapReady,
  addPointsEnabled,
  snapEnabled,
  baseMap,
  osDark = false,
  heatmapEnabled,
  heatmapSport,
  heatmapColor,
  dimBaseMap,
  personalHeatmapEnabled,
  explorerEnabled,
  explorerFilter,
  hoveredElevationPoint,
  hillshadeEnabled,
  poisEnabled,
  photosEnabled,
  onHeatmapClick,
  onPhotoClick,
  onClusterPhotosClick,
  onCloseActivityPopup,
  hoveredActivityRoute,
  hoveredActivityColor,
}: PlannerMapProps) {
  const mapTargetRef = useRef<HTMLDivElement>(null);
  const mapResult = useOpenLayersMap(mapTargetRef);
  const map = mapResult?.map ?? null;
  const waypointSourceRef = useRef<VectorSource | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointsRef = useRef(waypoints);
  const segmentsRef = useRef(segments);
  const addPointsRef = useRef(addPointsEnabled);
  const snapEnabledRef = useRef(snapEnabled);
  const heatmapLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const dimLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const hillshadeLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const personalHeatmapLayerRef = useRef<OlVectorTileLayer | null>(null);
  const explorerGridLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const explorerTilesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const explorerSquareLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const hoverSourceRef = useRef<VectorSource | null>(null);
  const hoverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const hoverOverlayRef = useRef<Overlay | null>(null);
  const activityHighlightSourceRef = useRef<VectorSource | null>(null);
  const activityHighlightLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const poisLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const poisSourceRef = useRef<VectorSource | null>(null);
  const poisPopupOverlayRef = useRef<Overlay | null>(null);
  const photosLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const photosSourceRef = useRef<VectorSource | null>(null);
  const superclusterRef = useRef<Supercluster | null>(null);
  const personalHeatmapEnabledRef = useRef(personalHeatmapEnabled);
  const photosEnabledRef = useRef(photosEnabled);
  const onHeatmapClickRef = useRef(onHeatmapClick);
  const onPhotoClickRef = useRef(onPhotoClick);
  const onClusterPhotosClickRef = useRef(onClusterPhotosClick);
  const onCloseActivityPopupRef = useRef(onCloseActivityPopup);

  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    addPointsRef.current = addPointsEnabled;
  }, [addPointsEnabled]);

  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

  useEffect(() => {
    personalHeatmapEnabledRef.current = personalHeatmapEnabled;
  }, [personalHeatmapEnabled]);

  useEffect(() => {
    photosEnabledRef.current = photosEnabled;
  }, [photosEnabled]);

  useEffect(() => {
    onHeatmapClickRef.current = onHeatmapClick;
  }, [onHeatmapClick]);

  useEffect(() => {
    onPhotoClickRef.current = onPhotoClick;
  }, [onPhotoClick]);

  useEffect(() => {
    onClusterPhotosClickRef.current = onClusterPhotosClick;
  }, [onClusterPhotosClick]);

  useEffect(() => {
    onCloseActivityPopupRef.current = onCloseActivityPopup;
  }, [onCloseActivityPopup]);

  // Toggle OS / satellite / topo base layers
  useEffect(() => {
    if (!mapResult) return;
    const isSatellite = baseMap === 'satellite';
    for (const layer of mapResult.osLayers) layer.setVisible(!isSatellite);
    mapResult.satelliteLayer.setVisible(isSatellite);
    mapResult.topoLayer.setVisible(!isSatellite);
  }, [mapResult, baseMap]);

  // Update OS and topo tile URLs when dark mode changes
  useEffect(() => {
    if (!mapResult) return;
    const osUrl   = osDark ? OS_DARK_TILE_URL   : OS_TILE_URL;
    const topoUrl = osDark ? TOPO_DARK_TILE_URL : TOPO_TILE_URL;
    for (const layer of mapResult.osLayers) {
      (layer.getSource() as XYZ).setUrl(osUrl);
    }
    (mapResult.topoLayer.getSource() as XYZ).setUrl(topoUrl);
  }, [mapResult, osDark]);


  // Manage heatmap tile layer
  useEffect(() => {
    if (!map) return;

    // Remove existing heatmap layer
    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }

    if (!heatmapEnabled) return;

    const heatmapLayer = new TileLayer({
      source: new XYZ({
        url: `/api/heatmap?sport=${heatmapSport}&color=${heatmapColor}&z={z}&x={x}&y={y}`,
        projection: 'EPSG:3857',
      }),
      opacity: 0.6,
      zIndex: 3,
    });

    map.addLayer(heatmapLayer);
    heatmapLayerRef.current = heatmapLayer;

    return () => {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
      }
    };
  }, [map, heatmapEnabled, heatmapSport, heatmapColor]);

  // Manage dim base map overlay
  useEffect(() => {
    if (!map) return;

    if (dimLayerRef.current) {
      map.removeLayer(dimLayerRef.current);
      dimLayerRef.current = null;
    }

    if (!(heatmapEnabled || personalHeatmapEnabled || explorerEnabled) || !dimBaseMap) return;

    const dimLayer = new TileLayer({
      source: new XYZ({
        url: 'data:image/png;base64,',
        tileLoadFunction: (tile) => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillRect(0, 0, 256, 256);
          (tile as unknown as { getImage: () => HTMLImageElement }).getImage().src = canvas.toDataURL();
        },
        projection: 'EPSG:3857',
      }),
      zIndex: 2,
    });

    map.addLayer(dimLayer);
    dimLayerRef.current = dimLayer;

    return () => {
      if (dimLayerRef.current) {
        map.removeLayer(dimLayerRef.current);
        dimLayerRef.current = null;
      }
    };
  }, [map, heatmapEnabled, personalHeatmapEnabled, explorerEnabled, dimBaseMap]);

  // Manage POI vector layer
  useEffect(() => {
    if (!map) return;
    if (poisLayerRef.current) {
      map.removeLayer(poisLayerRef.current);
      poisLayerRef.current = null;
      poisSourceRef.current = null;
      poisPopupOverlayRef.current?.setPosition(undefined);
    }
    if (!poisEnabled) return;

    const source = new VectorSource();
    const layer = new VectorLayer<VectorSource>({
      source,
      style: (feature) => {
        const type = feature.get('poiType') as string;
        if (type === 'waterfall') {
          return new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color: 'rgba(56, 189, 248, 0.9)' }),
              stroke: new Stroke({ color: 'rgba(14, 116, 144, 1)', width: 1.5 }),
            }),
          });
        }
        return new Style({
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#94a3b8' }),
          }),
        });
      },
      zIndex: 4.5,
    });
    map.addLayer(layer);
    poisLayerRef.current = layer;
    poisSourceRef.current = source;

    return () => {
      map.removeLayer(layer);
      poisLayerRef.current = null;
      poisSourceRef.current = null;
      poisPopupOverlayRef.current?.setPosition(undefined);
    };
  }, [map, poisEnabled]);

  // Fetch POIs from OS NGD on viewport change
  useEffect(() => {
    if (!map || !poisEnabled) return;

    let debounceTimer: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const fetchPois = async () => {
      const view = map.getView();
      const zoom = view.getZoom() ?? 0;
      // Hide markers below zoom 6 (they'd be too small to be useful at national scale)
      if (zoom < 6) {
        poisSourceRef.current?.clear();
        return;
      }
      const size = map.getSize();
      if (!size) return;
      const extent = view.calculateExtent(size);
      const [minLng, minLat, maxLng, maxLat] = transformExtent(extent, OS_PROJECTION.code, 'EPSG:4326');
      try {
        const res = await fetch(`/api/pois?bbox=${minLng},${minLat},${maxLng},${maxLat}`);
        if (!res.ok || isCancelled) return;
        const geojson = await res.json() as {
          features: Array<{
            geometry: { coordinates: [number, number] };
            properties: { poiType: string; name1_text?: string };
          }>;
        };
        if (isCancelled) return;
        const features = geojson.features.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          const olFeature = new Feature({ geometry: new Point(fromLonLat([lng, lat], OS_PROJECTION.code)) });
          olFeature.set('poiType', f.properties.poiType);
          olFeature.set('name', f.properties.name1_text ?? 'Waterfall');
          return olFeature;
        });
        poisSourceRef.current?.clear();
        poisSourceRef.current?.addFeatures(features);
      } catch { /* silently fail */ }
    };

    const onMoveEnd = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchPois, 400);
    };
    const key = map.on('moveend', onMoveEnd);
    fetchPois();

    return () => {
      isCancelled = true;
      unByKey(key);
      clearTimeout(debounceTimer);
      poisSourceRef.current?.clear();
      poisPopupOverlayRef.current?.setPosition(undefined);
    };
  }, [map, poisEnabled]);

  // Photo layer: load all photos once, cluster client-side with supercluster (no viewport fetches → no flicker)
  useEffect(() => {
    if (!map) return;
    const m = map;
    if (photosLayerRef.current) {
      m.removeLayer(photosLayerRef.current);
      photosLayerRef.current = null;
      photosSourceRef.current = null;
    }
    superclusterRef.current = null;
    if (!photosEnabled) return;

    const source = new VectorSource();
    const thumbnailCache: Record<string, HTMLCanvasElement | null | undefined> = {};

    // Load a URL into thumbnailCache as a 40×40 circular-clipped canvas with a white ring.
    function loadThumbnail(proxyUrl: string) {
      thumbnailCache[proxyUrl] = null;
      const img = new window.Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 40; c.height = 40;
        const ctx = c.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(20, 20, 19, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, 40, 40);
        ctx.beginPath();
        ctx.arc(20, 20, 19, 0, Math.PI * 2);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        thumbnailCache[proxyUrl] = c;
        source.changed(); // trigger re-render once thumbnail is ready
      };
      img.onerror = () => { thumbnailCache[proxyUrl] = null; };
      img.src = proxyUrl;
    }

    // Draw the stacked-photos cluster icon: shadow circles behind + top photo circle + count badge
    function makeClusterCanvas(count: number, topPhotoCanvas: HTMLCanvasElement): HTMLCanvasElement {
      const SIZE = 52;
      const PHOTO_R = 19;
      const cx = 22;
      const cy = 22;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      for (let i = 2; i >= 1; i--) {
        ctx.beginPath();
        ctx.arc(cx + i * 3, cy + i * 3, PHOTO_R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${0.18 * i})`;
        ctx.fill();
      }
      ctx.drawImage(topPhotoCanvas, cx - PHOTO_R, cy - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2);
      const label = String(count);
      const fontSize = 11;
      const tmp = document.createElement('canvas').getContext('2d')!;
      tmp.font = `700 ${fontSize}px sans-serif`;
      const textW = tmp.measureText(label).width;
      const bw = Math.max(18, Math.ceil(textW) + 10);
      const bh = 16;
      const bx = cx + PHOTO_R - bw / 2 + 4;
      const by = cy + PHOTO_R - bh / 2 + 4;
      const br = bh / 2;
      ctx.beginPath();
      ctx.moveTo(bx + br, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, br);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, br);
      ctx.arcTo(bx, by + bh, bx, by, br);
      ctx.arcTo(bx, by, bx + bw, by, br);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15,15,15,0.92)';
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = `700 ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + bw / 2, by + bh / 2);
      return canvas;
    }

    const layer = new VectorLayer({
      source,
      style: (feature) => {
        const url = feature.get('url') as string;
        const proxyUrl = `/api/photos/proxy?url=${encodeURIComponent(url)}`;

        if (feature.get('isCluster')) {
          const count = feature.get('pointCount') as number;
          const cached = thumbnailCache[proxyUrl];
          if (cached) {
            const clusterCanvas = makeClusterCanvas(count, cached);
            return new Style({ image: new Icon({ img: clusterCanvas, size: [clusterCanvas.width, clusterCanvas.height] }) });
          }
          if (cached === undefined) loadThumbnail(proxyUrl);
          return new Style({
            image: new CircleStyle({
              radius: 19,
              fill: new Fill({ color: 'rgba(20,20,20,0.85)' }),
              stroke: new Stroke({ color: 'white', width: 2 }),
            }),
          });
        }

        // Individual photo
        const cached = thumbnailCache[proxyUrl];
        if (cached) {
          return new Style({ image: new Icon({ img: cached, size: [40, 40] }) });
        }
        if (cached === undefined) loadThumbnail(proxyUrl);
        return new Style({
          image: new CircleStyle({
            radius: 14,
            fill: new Fill({ color: 'rgba(74,90,43,0.82)' }),
            stroke: new Stroke({ color: 'rgba(58,71,34,0.9)', width: 2 }),
          }),
        });
      },
      zIndex: 4.8,
    });

    m.addLayer(layer);
    photosLayerRef.current = layer;
    photosSourceRef.current = source;

    // Convert the map's current resolution to an equivalent web-mercator zoom level.
    // Needed because supercluster clusters in WM tile space but the map uses EPSG:27700.
    function getSupercluserZoom(): number {
      const view = m.getView();
      const resolution = view.getResolution() ?? 1;
      const center = view.getCenter() ?? [0, 0];
      const [, centerLat] = toLonLat(center, OS_PROJECTION.code);
      const centerLatRad = centerLat * Math.PI / 180;
      const wmZoom = Math.log2(156543.03 * Math.cos(centerLatRad) / resolution);
      return Math.max(0, Math.min(14, Math.floor(wmZoom)));
    }

    // Synchronously rebuild the OL source from the supercluster index for the current viewport.
    // clear() + addFeatures() in the same synchronous call → no intermediate blank state → no flicker.
    function updateClusters() {
      if (!superclusterRef.current) return;
      const view = m.getView();
      const size = m.getSize();
      if (!size) return;
      const extent = view.calculateExtent(size);
      const [minLng, minLat, maxLng, maxLat] = transformExtent(extent, OS_PROJECTION.code, 'EPSG:4326');
      const scZoom = getSupercluserZoom();

      const clusters = superclusterRef.current.getClusters([minLng, minLat, maxLng, maxLat], scZoom);

      const features = clusters.map((c) => {
        const [lng, lat] = c.geometry.coordinates as [number, number];
        const f = new Feature({ geometry: new Point(fromLonLat([lng, lat], OS_PROJECTION.code)) });
        if (c.properties.cluster) {
          const leaf = superclusterRef.current!.getLeaves(c.properties.cluster_id, 1)[0];
          f.set('isCluster', true);
          f.set('clusterId', c.properties.cluster_id);
          f.set('pointCount', c.properties.point_count);
          f.set('url', (leaf?.properties as PhotoItem | undefined)?.url ?? '');
        } else {
          const p = c.properties as PhotoItem;
          f.set('isCluster', false);
          f.set('url', p.url);
          f.set('photoId', p.photoId);
          f.set('lat', p.lat);
          f.set('lng', p.lng);
          f.set('activityId', p.activityId);
          f.set('activityName', p.activityName);
          f.set('activityDate', p.activityDate);
          f.set('activityDistance', p.activityDistance);
          f.set('sportType', p.sportType);
        }
        return f;
      });

      source.clear();
      source.addFeatures(features);
    }

    // Load all photos once, then set up moveend to re-cluster synchronously
    let isCancelled = false;
    fetch('/api/photos')
      .then((res) => res.ok ? res.json() : Promise.reject(res.status))
      .then((data: { photos: PhotoItem[] }) => {
        if (isCancelled) return;
        const index = new Supercluster({ radius: 60, maxZoom: 14 });
        index.load(data.photos.map((p) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: p,
        })));
        superclusterRef.current = index;
        updateClusters();
      })
      .catch(() => { /* photos unavailable — layer stays empty */ });

    const moveKey = m.on('moveend', updateClusters);

    return () => {
      isCancelled = true;
      unByKey(moveKey);
      m.removeLayer(layer);
      photosLayerRef.current = null;
      photosSourceRef.current = null;
      superclusterRef.current = null;
    };
  }, [map, photosEnabled]);

  // Manage hillshade tile layer
  useEffect(() => {
    if (!map) return;
    if (hillshadeLayerRef.current) {
      map.removeLayer(hillshadeLayerRef.current);
      hillshadeLayerRef.current = null;
    }
    if (!hillshadeEnabled || baseMap !== 'os') return;
    const layer = new TileLayer({
      source: new XYZ({
        url: `/api/hillshade?z={z}&x={x}&y={y}${osDark ? '&dark=1' : ''}`,
        projection: 'EPSG:3857',
      }),
      zIndex: 1.5,
    });
    map.addLayer(layer);
    hillshadeLayerRef.current = layer;
    return () => {
      map.removeLayer(layer);
      hillshadeLayerRef.current = null;
    };
  }, [map, hillshadeEnabled, osDark, baseMap]);

  // Manage personal heatmap vector tile layer
  useEffect(() => {
    if (!map) return;

    if (personalHeatmapLayerRef.current) {
      map.removeLayer(personalHeatmapLayerRef.current);
      personalHeatmapLayerRef.current = null;
    }

    if (!personalHeatmapEnabled) return;

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
      zIndex: 4,
    });

    map.addLayer(layer);
    personalHeatmapLayerRef.current = layer;

    return () => {
      if (personalHeatmapLayerRef.current) {
        map.removeLayer(personalHeatmapLayerRef.current);
        personalHeatmapLayerRef.current = null;
      }
    };
  }, [map, personalHeatmapEnabled]);

  /** Convert OSM tile x/y at a given zoom to a polygon in EPSG:27700 */
  const tileToPolygonCoords = useCallback((x: number, y: number, zoom: number): number[][] => {
    const n = 1 << zoom;
    const lonLeft = (x / n) * 360 - 180;
    const lonRight = ((x + 1) / n) * 360 - 180;
    const latTopRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const latBottomRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
    const latTop = (latTopRad * 180) / Math.PI;
    const latBottom = (latBottomRad * 180) / Math.PI;

    return [
      fromLonLat([lonLeft, latTop], OS_PROJECTION.code),
      fromLonLat([lonRight, latTop], OS_PROJECTION.code),
      fromLonLat([lonRight, latBottom], OS_PROJECTION.code),
      fromLonLat([lonLeft, latBottom], OS_PROJECTION.code),
      fromLonLat([lonLeft, latTop], OS_PROJECTION.code),
    ];
  }, []);

  /** Convert lat/lng to z14 tile coordinates (same formula as backend) */
  const latLngToTile = useCallback((lat: number, lng: number, zoom: number) => {
    const n = 1 << zoom;
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { x, y };
  }, []);

  // Explorer: visited tiles + max square layers
  useEffect(() => {
    if (!map) return;

    // Cleanup previous layers
    if (explorerTilesLayerRef.current) {
      map.removeLayer(explorerTilesLayerRef.current);
      explorerTilesLayerRef.current = null;
    }
    if (explorerSquareLayerRef.current) {
      map.removeLayer(explorerSquareLayerRef.current);
      explorerSquareLayerRef.current = null;
    }

    if (!explorerEnabled) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchExplorerData = (retriesLeft: number) => {
      fetch(`/api/explorer?filter=${encodeURIComponent(explorerFilter)}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data: { status?: string; tiles?: [number, number][]; maxSquare?: { x: number; y: number; size: number } | null } | null) => {
          if (cancelled || !data) return;

          // Backend is still computing — poll again
          if (data.status === 'computing') {
            if (retriesLeft > 0) {
              pollTimer = setTimeout(() => fetchExplorerData(retriesLeft - 1), 2000);
            }
            return;
          }

          if (!data.tiles) return;

          // Visited tiles layer
          const tilesSource = new VectorSource();
          for (const [x, y] of data.tiles) {
            const coords = tileToPolygonCoords(x, y, 14);
            const feature = new Feature({ geometry: new Polygon([coords]) });
            tilesSource.addFeature(feature);
          }

          const tilesLayer = new VectorLayer({
            source: tilesSource,
            style: new Style({
              fill: new Fill({ color: 'rgba(46, 204, 113, 0.25)' }),
              stroke: new Stroke({ color: 'rgba(46, 204, 113, 0.5)', width: 0.5 }),
            }),
            zIndex: 3.5,
          });

          map.addLayer(tilesLayer);
          explorerTilesLayerRef.current = tilesLayer;

          // Max square layer
          if (data.maxSquare) {
            const { x, y, size } = data.maxSquare;
            const squareCoords = [
              fromLonLat([(x / (1 << 14)) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (1 << 14)))) * 180) / Math.PI], OS_PROJECTION.code),
              fromLonLat([((x + size) / (1 << 14)) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (1 << 14)))) * 180) / Math.PI], OS_PROJECTION.code),
              fromLonLat([((x + size) / (1 << 14)) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + size)) / (1 << 14)))) * 180) / Math.PI], OS_PROJECTION.code),
              fromLonLat([(x / (1 << 14)) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + size)) / (1 << 14)))) * 180) / Math.PI], OS_PROJECTION.code),
              fromLonLat([(x / (1 << 14)) * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (1 << 14)))) * 180) / Math.PI], OS_PROJECTION.code),
            ];

            const squareSource = new VectorSource();
            squareSource.addFeature(new Feature({ geometry: new Polygon([squareCoords]) }));

            const squareLayer = new VectorLayer({
              source: squareSource,
              style: new Style({
                fill: new Fill({ color: 'rgba(231, 76, 60, 0.08)' }),
                stroke: new Stroke({ color: 'rgba(231, 76, 60, 0.9)', width: 3 }),
              }),
              zIndex: 3.6,
            });

            map.addLayer(squareLayer);
            explorerSquareLayerRef.current = squareLayer;
          }
        })
        .catch(() => { /* silently fail */ });
    };

    fetchExplorerData(15);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (explorerTilesLayerRef.current) {
        map.removeLayer(explorerTilesLayerRef.current);
        explorerTilesLayerRef.current = null;
      }
      if (explorerSquareLayerRef.current) {
        map.removeLayer(explorerSquareLayerRef.current);
        explorerSquareLayerRef.current = null;
      }
    };
  }, [map, explorerEnabled, explorerFilter, tileToPolygonCoords]);

  // Explorer: z14 grid overlay (unclaimed tile outlines)
  useEffect(() => {
    if (!map) return;

    if (explorerGridLayerRef.current) {
      map.removeLayer(explorerGridLayerRef.current);
      explorerGridLayerRef.current = null;
    }

    if (!explorerEnabled) return;

    const gridSource = new VectorSource();
    const gridLayer = new VectorLayer({
      source: gridSource,
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(80, 80, 80, 0.5)',
          width: 1,
        }),
      }),
      zIndex: 3.4,
    });
    map.addLayer(gridLayer);
    explorerGridLayerRef.current = gridLayer;

    const updateGrid = () => {
      gridSource.clear();
      const extent = map.getView().calculateExtent(map.getSize());
      // Convert extent from EPSG:27700 to EPSG:4326
      const [minLon, minLat, maxLon, maxLat] = transformExtent(extent, OS_PROJECTION.code, 'EPSG:4326');

      const topLeft = latLngToTile(maxLat, minLon, 14);
      const bottomRight = latLngToTile(minLat, maxLon, 14);

      const tilesX = bottomRight.x - topLeft.x + 1;
      const tilesY = bottomRight.y - topLeft.y + 1;

      // Skip if too many tiles visible
      if (tilesX * tilesY > 5000) return;

      for (let x = topLeft.x; x <= bottomRight.x; x++) {
        for (let y = topLeft.y; y <= bottomRight.y; y++) {
          const coords = tileToPolygonCoords(x, y, 14);
          gridSource.addFeature(new Feature({ geometry: new Polygon([coords]) }));
        }
      }
    };

    updateGrid();
    map.on('moveend', updateGrid);

    return () => {
      map.un('moveend', updateGrid);
      if (explorerGridLayerRef.current) {
        map.removeLayer(explorerGridLayerRef.current);
        explorerGridLayerRef.current = null;
      }
    };
  }, [map, explorerEnabled, tileToPolygonCoords, latLngToTile]);

  // Update cursor when addPointsEnabled changes
  useEffect(() => {
    if (!map) return;
    const viewport = map.getViewport();
    // If add-points is off and cursor is currently crosshair, reset it
    if (!addPointsEnabled && viewport.style.cursor === 'crosshair') {
      viewport.style.cursor = '';
    }
  }, [map, addPointsEnabled]);

  // Initialize vector layers once the map is ready
  useEffect(() => {
    if (!map) return;

    const waypointSource = new VectorSource();
    const routeSource = new VectorSource();

    const waypointLayer = new VectorLayer({
      source: waypointSource,
      zIndex: 10,
    });

    const routeLayer = new VectorLayer({
      source: routeSource,
      zIndex: 5,
      opacity: 0.45,
    });

    map.addLayer(routeLayer);
    map.addLayer(waypointLayer);

    waypointSourceRef.current = waypointSource;
    routeSourceRef.current = routeSource;

    // Waypoint popup overlay (delete + snap toggles)
    const popupEl = document.createElement('div');
    popupEl.className = 'ol-waypoint-popup';

    // Snap "from previous" button (← icon)
    const snapFromSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>';
    // Snap "to next" button (→ icon)
    const snapToSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>';

    popupEl.innerHTML =
      '<button class="ol-snap-btn ol-snap-from" title="Toggle snap from previous">' + snapFromSvg + '</button>' +
      '<button class="ol-delete-btn" title="Delete waypoint">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="3 6 5 6 21 6"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '</svg></button>' +
      '<button class="ol-snap-btn ol-snap-to" title="Toggle snap to next">' + snapToSvg + '</button>';

    const deleteOverlay = new Overlay({
      element: popupEl,
      positioning: 'bottom-center',
      offset: [0, -46],
      stopEvent: true,
    });
    map.addOverlay(deleteOverlay);

    const snapFromBtn = popupEl.querySelector('.ol-snap-from') as HTMLButtonElement;
    const snapToBtn = popupEl.querySelector('.ol-snap-to') as HTMLButtonElement;

    // POI name popup overlay
    const poisPopupEl = document.createElement('div');
    Object.assign(poisPopupEl.style, {
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(4px)',
      borderRadius: '8px',
      boxShadow: '0 1px 8px rgba(0, 0, 0, 0.18)',
      padding: '4px 10px',
      fontSize: '13px',
      color: '#1C1814',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      border: '1px solid rgba(0, 0, 0, 0.08)',
    });
    const poisPopupOverlay = new Overlay({
      element: poisPopupEl,
      positioning: 'bottom-center',
      offset: [0, -14],
      stopEvent: false,
    });
    map.addOverlay(poisPopupOverlay);
    poisPopupOverlayRef.current = poisPopupOverlay;

    // Insert popup overlay (for touch route taps)
    const insertPopupEl = document.createElement('div');
    insertPopupEl.className = 'ol-insert-popup';
    insertPopupEl.innerHTML = '<button class="ol-insert-btn" title="Add waypoint here">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' +
      '</svg></button>';

    const insertOverlay = new Overlay({
      element: insertPopupEl,
      positioning: 'bottom-center',
      offset: [0, -10],
      stopEvent: true,
    });
    map.addOverlay(insertOverlay);

    let insertCoord: number[] | null = null;
    let insertSegmentIndex: number | null = null;

    const hideInsertPopup = () => {
      insertCoord = null;
      insertSegmentIndex = null;
      insertOverlay.setPosition(undefined);
    };

    insertPopupEl.querySelector('.ol-insert-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (insertCoord) {
        const index = findInsertionIndex(insertCoord, waypointsRef.current);
        const [lng, lat] = toLonLat(insertCoord, OS_PROJECTION.code);
        // Inherit snap state from the segment being split
        const seg = segmentsRef.current[insertSegmentIndex ?? Math.max(0, index - 1)];
        dispatch({
          type: 'INSERT_WAYPOINT',
          index,
          waypoint: { lat, lng },
          snap: seg?.snapped,
        });
        navigator.vibrate?.(15);
      }
      hideInsertPopup();
    });

    let deleteTargetIndex: number | null = null;

    const updateSnapButtons = (index: number) => {
      const segs = segmentsRef.current;
      const wpCount = waypointsRef.current.length;

      // "From previous" — controls segment[index - 1]
      if (index === 0) {
        snapFromBtn.disabled = true;
        snapFromBtn.classList.remove('ol-snap-active');
      } else {
        snapFromBtn.disabled = false;
        const isSnapped = segs[index - 1]?.snapped ?? false;
        snapFromBtn.classList.toggle('ol-snap-active', isSnapped);
      }

      // "To next" — controls segment[index]
      if (index >= wpCount - 1) {
        snapToBtn.disabled = true;
        snapToBtn.classList.remove('ol-snap-active');
      } else {
        snapToBtn.disabled = false;
        const isSnapped = segs[index]?.snapped ?? false;
        snapToBtn.classList.toggle('ol-snap-active', isSnapped);
      }
    };

    const showDeletePopup = (coordinate: number[], index: number) => {
      deleteTargetIndex = index;
      updateSnapButtons(index);
      deleteOverlay.setPosition(coordinate);
      navigator.vibrate?.(40);
    };

    const hideDeletePopup = () => {
      deleteTargetIndex = null;
      deleteOverlay.setPosition(undefined);
    };

    popupEl.querySelector('.ol-delete-btn')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deleteTargetIndex !== null) {
        dispatch({ type: 'REMOVE_WAYPOINT', index: deleteTargetIndex });
        navigator.vibrate?.(30);
      }
      hideDeletePopup();
    });

    snapFromBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deleteTargetIndex !== null && deleteTargetIndex > 0) {
        dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index: deleteTargetIndex - 1 });
        // Update button state immediately
        const seg = segmentsRef.current[deleteTargetIndex - 1];
        snapFromBtn.classList.toggle('ol-snap-active', !seg?.snapped);
        navigator.vibrate?.(15);
      }
    });

    snapToBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (deleteTargetIndex !== null && deleteTargetIndex < waypointsRef.current.length - 1) {
        dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index: deleteTargetIndex });
        // Update button state immediately
        const seg = segmentsRef.current[deleteTargetIndex];
        snapToBtn.classList.toggle('ol-snap-active', !seg?.snapped);
        navigator.vibrate?.(15);
      }
    });

    // Custom drag-to-insert on route lines.
    // OL's Modify interaction can't handle dense routed paths (moves vertices instead of inserting).
    // This manually tracks pointerdown→drag→pointerup on route features.
    const dragInsertStyle = new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: 'rgba(74, 90, 43, 0.5)' }),
        stroke: new Stroke({ color: '#4A5A2B', width: 2 }),
      }),
    });

    let dragInsertSegIdx: number | null = null;
    let dragInsertSnapped: boolean = false;
    let dragInsertFeature: Feature | null = null;
    let dragInsertMoved = false;

    const viewport = map.getViewport();

    const onDragPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;

      const pixel = map.getEventPixel(e);

      // Don't start route drag if we hit a waypoint
      const waypointHit = map.forEachFeatureAtPixel(pixel, () => true, {
        layerFilter: (layer) => layer === waypointLayer,
        hitTolerance: 8,
      });
      if (waypointHit) return;

      const routeFeature = map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (layer) => layer === routeLayer,
        hitTolerance: 10,
      });
      if (!routeFeature) return;

      dragInsertSegIdx = routeFeature.get('segmentIndex') as number;
      dragInsertSnapped = routeFeature.get('snapped') as boolean;
      dragInsertMoved = false;

      const coord = map.getCoordinateFromPixel(pixel);

      // Show drag indicator at pointer position
      dragInsertFeature = new Feature({ geometry: new Point(coord) });
      dragInsertFeature.setStyle(dragInsertStyle);
      waypointSource.addFeature(dragInsertFeature);

      // Disable map panning while dragging on route
      map.getInteractions().forEach((i) => {
        if (i instanceof DragPan) i.setActive(false);
      });
    };

    const onDragPointerMove = (e: PointerEvent) => {
      if (dragInsertSegIdx === null || !dragInsertFeature) return;
      if (!e.buttons) {
        // Mouse released outside viewport — clean up
        waypointSource.removeFeature(dragInsertFeature);
        dragInsertFeature = null;
        dragInsertSegIdx = null;
        map.getInteractions().forEach((i) => {
          if (i instanceof DragPan) i.setActive(true);
        });
        return;
      }
      dragInsertMoved = true;
      const pixel = map.getEventPixel(e);
      const coord = map.getCoordinateFromPixel(pixel);
      (dragInsertFeature.getGeometry() as Point).setCoordinates(coord);
    };

    const onDragPointerUp = () => {
      if (dragInsertSegIdx === null) return;

      // Re-enable map panning
      map.getInteractions().forEach((i) => {
        if (i instanceof DragPan) i.setActive(true);
      });

      const coord = dragInsertFeature
        ? (dragInsertFeature.getGeometry() as Point).getCoordinates()
        : null;

      // Clean up drag indicator
      if (dragInsertFeature) {
        waypointSource.removeFeature(dragInsertFeature);
        dragInsertFeature = null;
      }

      const segIdx = dragInsertSegIdx;
      const isSnapped = dragInsertSnapped;
      const moved = dragInsertMoved;
      dragInsertSegIdx = null;

      // Only insert if the user actually dragged (not just clicked — click handler handles that)
      if (!moved || !coord) return;

      const [lng, lat] = toLonLat(coord, OS_PROJECTION.code);
      dispatch({
        type: 'INSERT_WAYPOINT',
        index: segIdx + 1,
        waypoint: { lat, lng },
        snap: isSnapped,
      });
      navigator.vibrate?.(15);
    };

    viewport.addEventListener('pointerdown', onDragPointerDown);
    viewport.addEventListener('pointermove', onDragPointerMove);
    viewport.addEventListener('pointerup', onDragPointerUp);

    // Waypoint modify — added SECOND so it has HIGHER priority.
    const pinHighlightSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50" viewBox="-3 -3 38 50">' +
      '<path d="M16 44c-3-10-14-18-14-28a14 14 0 1 1 28 0c0 10-11 18-14 28Z" ' +
      'fill="none" stroke="rgba(74,90,43,0.4)" stroke-width="5"/>' +
      '</svg>';

    const waypointModify = new Modify({
      source: waypointSource,
      hitDetection: waypointLayer,
      style: new Style({
        image: new Icon({
          src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinHighlightSvg)}`,
          anchor: [0.5, 47 / 50],
          anchorXUnits: 'fraction',
          anchorYUnits: 'fraction',
        }),
      }),
    });

    let geometryChangeKey: EventsKey | null = null;

    waypointModify.on('modifystart', (e) => {
      const feature = e.features.getArray()[0];
      if (!feature) return;
      const dragIndex = feature.get('waypointIndex') as number;
      if (typeof dragIndex !== 'number') return;

      const geom = feature.getGeometry() as Point;
      geometryChangeKey = geom.on('change', () => {
        const newCoord = geom.getCoordinates();

        // During drag: update adjacent route line segments to show straight dashed lines to drag position
        const routeFeatures = routeSource.getFeatures();
        for (const rf of routeFeatures) {
          const segIdx = rf.get('segmentIndex') as number;
          if (typeof segIdx !== 'number') continue;

          if (segIdx === dragIndex - 1) {
            // Segment ending at dragged waypoint
            const lineGeom = rf.getGeometry() as LineString;
            const startWp = waypointsRef.current[dragIndex - 1];
            const startCoord = fromLonLat([startWp.lng, startWp.lat], OS_PROJECTION.code);
            lineGeom.setCoordinates([startCoord, newCoord]);
            rf.setStyle(dragTempStyle);
          } else if (segIdx === dragIndex) {
            // Segment starting at dragged waypoint
            const lineGeom = rf.getGeometry() as LineString;
            const endWp = waypointsRef.current[dragIndex + 1];
            const endCoord = fromLonLat([endWp.lng, endWp.lat], OS_PROJECTION.code);
            lineGeom.setCoordinates([newCoord, endCoord]);
            rf.setStyle(dragTempStyle);
          }
        }

        // Track delete overlay if open for this waypoint
        if (deleteTargetIndex === dragIndex) {
          deleteOverlay.setPosition(newCoord);
        }
      });
    });

    waypointModify.on('modifyend', (e) => {
      if (geometryChangeKey) {
        unByKey(geometryChangeKey);
        geometryChangeKey = null;
      }
      const features = e.features.getArray();
      for (const feature of features) {
        const index = feature.get('waypointIndex') as number;
        const geom = feature.getGeometry() as Point;
        const coord = geom.getCoordinates();
        const [lng, lat] = toLonLat(coord, OS_PROJECTION.code);
        dispatch({ type: 'MOVE_WAYPOINT', index, waypoint: { lat, lng } });
      }
    });

    map.addInteraction(waypointModify);

    // Click handler: waypoint hit → show delete popup, empty click → hide popup + optionally add waypoint
    map.on('click', (e) => {
      // Check for waypoint hit first
      const waypointFeature = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
        layerFilter: (layer) => layer === waypointLayer,
      });
      if (waypointFeature) {
        const origEvent = e.originalEvent as PointerEvent;
        if (origEvent.pointerType === 'touch') return; // mobile: long-press only
        const index = waypointFeature.get('waypointIndex') as number;
        if (typeof index === 'number') {
          const geom = waypointFeature.getGeometry() as Point;
          showDeletePopup(geom.getCoordinates(), index);
        }
        poisPopupOverlayRef.current?.setPosition(undefined);
        onCloseActivityPopupRef.current?.();
        return;
      }

      // Check for POI feature hit
      const poisFeature = poisLayerRef.current
        ? map.forEachFeatureAtPixel(e.pixel, (f) => f, {
            layerFilter: (layer) => layer === poisLayerRef.current,
            hitTolerance: 8,
          })
        : null;
      if (poisFeature) {
        const name = (poisFeature as Feature).get('name') as string;
        poisPopupOverlayRef.current!.getElement()!.textContent = name;
        poisPopupOverlayRef.current!.setPosition(e.coordinate);
        hideDeletePopup();
        hideInsertPopup();
        onCloseActivityPopupRef.current?.();
        return;
      }

      // Check for photo feature hit
      if (photosLayerRef.current && !addPointsRef.current) {
        const photoClusterFeature = map.forEachFeatureAtPixel(e.pixel, (f) => f as Feature, {
          layerFilter: (layer) => layer === photosLayerRef.current,
          hitTolerance: 10,
        });
        if (photoClusterFeature) {
          const evt = e.originalEvent as MouseEvent;

          if (photoClusterFeature.get('isCluster')) {
            const clusterId = photoClusterFeature.get('clusterId') as number;
            const center = (photoClusterFeature.getGeometry() as Point).getCoordinates();
            const olZoom = map.getView().getZoom() ?? 0;
            const maxZoom = map.getView().getMaxZoom() ?? 14;

            // Recompute supercluster zoom to match what updateClusters used
            const resolution = map.getView().getResolution() ?? 1;
            const [, centerLat] = toLonLat(map.getView().getCenter() ?? [0, 0], OS_PROJECTION.code);
            const centerLatRad = centerLat * Math.PI / 180;
            const wmZoom = Math.log2(156543.03 * Math.cos(centerLatRad) / resolution);
            const scZoom = Math.max(0, Math.min(14, Math.floor(wmZoom)));

            const scExpansion = superclusterRef.current!.getClusterExpansionZoom(clusterId);
            // Delta between SC zoom scales maps 1:1 to OL zoom levels (both are powers-of-2)
            const targetOlZoom = Math.min(olZoom + (scExpansion - scZoom), maxZoom);

            if (targetOlZoom > olZoom) {
              map.getView().animate({ center, zoom: targetOlZoom, duration: 300 });
            } else {
              // Can't expand further — photos at same location, show popup
              const leaves = superclusterRef.current!.getLeaves(clusterId, Infinity);
              const clusterPhotos: PhotoItem[] = leaves.map((l) => l.properties as PhotoItem);
              onClusterPhotosClickRef.current?.(clusterPhotos, evt.clientX, evt.clientY);
            }
          } else {
            const photo: PhotoItem = {
              photoId: photoClusterFeature.get('photoId'),
              url: photoClusterFeature.get('url'),
              lat: photoClusterFeature.get('lat'),
              lng: photoClusterFeature.get('lng'),
              activityId: photoClusterFeature.get('activityId'),
              activityName: photoClusterFeature.get('activityName'),
              activityDate: photoClusterFeature.get('activityDate'),
              activityDistance: photoClusterFeature.get('activityDistance'),
              sportType: photoClusterFeature.get('sportType'),
            };
            onPhotoClickRef.current?.(photo, evt.clientX, evt.clientY);
          }
          hideDeletePopup();
          hideInsertPopup();
          poisPopupOverlayRef.current?.setPosition(undefined);
          return;
        }
      }

      // Hide popups on any non-waypoint/poi click
      const hadPoiPopup = poisPopupOverlayRef.current?.getPosition() !== undefined;
      if (hadPoiPopup) poisPopupOverlayRef.current!.setPosition(undefined);
      const hadPopup = deleteTargetIndex !== null || insertCoord !== null || hadPoiPopup;
      if (deleteTargetIndex !== null) hideDeletePopup();
      if (insertCoord !== null) hideInsertPopup();
      if (hadPopup) return;

      // Check for route line hit
      const routeFeature = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
        layerFilter: (layer) => layer === routeLayer,
        hitTolerance: 6,
      });
      if (routeFeature) {
        const origEvent = e.originalEvent as PointerEvent;
        const segIndex = routeFeature.get('segmentIndex') as number;
        const isSnapped = routeFeature.get('snapped') as boolean;

        if (origEvent.pointerType === 'touch') {
          // Touch: show insert popup for all segment types
          insertCoord = e.coordinate;
          insertSegmentIndex = segIndex ?? null;
          insertOverlay.setPosition(e.coordinate);
          navigator.vibrate?.(15);
        } else {
          // Desktop click on any segment: insert waypoint directly
          const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
          dispatch({
            type: 'INSERT_WAYPOINT',
            index: segIndex + 1,
            waypoint: { lat, lng },
            snap: isSnapped,
          });
          navigator.vibrate?.(15);
        }
        onCloseActivityPopupRef.current?.();
        return;
      }

      // Heatmap click — show activity popup
      if (personalHeatmapEnabledRef.current && !addPointsRef.current) {
        const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
        const evt = e.originalEvent as MouseEvent;
        onHeatmapClickRef.current?.(lat, lng, evt.clientX, evt.clientY);
        return;
      }

      // Add waypoint only if toggle is on
      if (!addPointsRef.current) return;

      const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
      dispatch({
        type: 'ADD_WAYPOINT',
        waypoint: { lat, lng },
        snap: snapEnabledRef.current,
      });
      navigator.vibrate?.(15);
    });

    // Right-click on waypoint → show delete popup
    map.getViewport().addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pixel = map.getEventPixel(e);
      const feature = map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (layer) => layer === waypointLayer,
      });
      if (feature) {
        const index = feature.get('waypointIndex') as number;
        if (typeof index === 'number') {
          const geom = feature.getGeometry() as Point;
          showDeletePopup(geom.getCoordinates(), index);
        }
      }
    });

    // Long-press on waypoint → show delete popup (mobile)
    map.getViewport().addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      const pixel = map.getEventPixel(e);
      const feature = map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (layer) => layer === waypointLayer,
      });
      if (!feature) return;

      longPressTimerRef.current = setTimeout(() => {
        const index = feature.get('waypointIndex') as number;
        if (typeof index === 'number') {
          const geom = feature.getGeometry() as Point;
          showDeletePopup(geom.getCoordinates(), index);
        }
      }, 500);
    });

    const clearLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
    map.getViewport().addEventListener('pointerup', clearLongPress);
    map.getViewport().addEventListener('pointermove', clearLongPress);

    // Cursor changes on hover
    map.on('pointermove', (e) => {
      if (e.dragging) return;
      const viewport = map.getViewport();
      const waypointHit = map.forEachFeatureAtPixel(e.pixel, () => true, {
        layerFilter: (layer) => layer === waypointLayer,
        hitTolerance: 8,
      });
      if (waypointHit) {
        viewport.style.cursor = 'move';
        return;
      }
      const routeHit = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
        layerFilter: (layer) => layer === routeLayer,
        hitTolerance: 6,
      });
      if (routeHit) {
        viewport.style.cursor = 'copy';
        return;
      }
      if (poisLayerRef.current) {
        const poisHit = map.forEachFeatureAtPixel(e.pixel, () => true, {
          layerFilter: (layer) => layer === poisLayerRef.current,
          hitTolerance: 8,
        });
        if (poisHit) {
          viewport.style.cursor = 'pointer';
          return;
        }
      }
      if (photosLayerRef.current && !addPointsRef.current) {
        const photosHit = map.forEachFeatureAtPixel(e.pixel, () => true, {
          layerFilter: (layer) => layer === photosLayerRef.current,
          hitTolerance: 10,
        });
        if (photosHit) {
          viewport.style.cursor = 'pointer';
          return;
        }
      }
      if (personalHeatmapEnabledRef.current && !addPointsRef.current) {
        viewport.style.cursor = 'pointer';
        return;
      }
      viewport.style.cursor = addPointsRef.current ? 'crosshair' : '';
    });

    // Initial sync for waypoints loaded from localStorage before map was ready
    syncFeatures(waypointSource, routeSource, waypointsRef.current, segmentsRef.current);

    onMapReady?.(map);

    return () => {
      viewport.removeEventListener('pointerdown', onDragPointerDown);
      viewport.removeEventListener('pointermove', onDragPointerMove);
      viewport.removeEventListener('pointerup', onDragPointerUp);
      map.removeLayer(routeLayer);
      map.removeLayer(waypointLayer);
      map.removeInteraction(waypointModify);
      map.removeOverlay(deleteOverlay);
      map.removeOverlay(insertOverlay);
      map.removeOverlay(poisPopupOverlay);
      poisPopupOverlayRef.current = null;
      waypointSourceRef.current = null;
      routeSourceRef.current = null;
    };
  }, [map, dispatch, onMapReady]);

  // Sync waypoints + segments to OL features
  useEffect(() => {
    syncFeatures(waypointSourceRef.current, routeSourceRef.current, waypoints, segments);
  }, [waypoints, segments]);

  // Elevation hover marker + tooltip
  useEffect(() => {
    if (!map) return;

    if (!hoverSourceRef.current) {
      const source = new VectorSource();
      const layer = new VectorLayer({
        source,
        zIndex: 15,
      });
      map.addLayer(layer);
      hoverSourceRef.current = source;
      hoverLayerRef.current = layer;
    }

    if (!hoverOverlayRef.current) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(4px)',
        borderRadius: '6px',
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.2)',
        padding: '3px 8px',
        fontSize: '12px',
        color: '#1C1814',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      });
      const overlay = new Overlay({
        element: el,
        positioning: 'bottom-center',
        offset: [0, -20],
        stopEvent: false,
      });
      map.addOverlay(overlay);
      hoverOverlayRef.current = overlay;
    }

    const source = hoverSourceRef.current;
    const overlay = hoverOverlayRef.current;
    source.clear();

    if (hoveredElevationPoint) {
      const coord = fromLonLat(
        [hoveredElevationPoint.lng, hoveredElevationPoint.lat],
        OS_PROJECTION.code
      );
      const feature = new Feature({ geometry: new Point(coord) });
      feature.setStyle([
        new Style({
          image: new CircleStyle({
            radius: 12,
            fill: new Fill({ color: 'rgba(74, 90, 43, 0.15)' }),
            stroke: new Stroke({ color: 'rgba(74, 90, 43, 0.3)', width: 1 }),
          }),
        }),
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: '#4A5A2B' }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
        }),
      ]);
      source.addFeature(feature);

      // Tooltip content
      const dist = hoveredElevationPoint.distance;
      const distStr = dist < 1000
        ? `${Math.round(dist)}m`
        : `${(dist / 1000).toFixed(1)}km`;
      const eleStr = `${Math.round(hoveredElevationPoint.ele)}m`;

      const mountainIcon = '<svg style="display:inline-block;vertical-align:-1px;margin-right:2px;flex-shrink:0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>';
      const arrowIcon = '<svg style="display:inline-block;vertical-align:-1px;margin-right:2px;flex-shrink:0" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

      const el = overlay.getElement()!;
      el.innerHTML =
        `<span style="display:inline-flex;align-items:center;opacity:0.7">${arrowIcon}${distStr}</span>` +
        `<span style="display:inline-flex;align-items:center;font-weight:600;margin-left:6px">${mountainIcon}${eleStr}</span>`;
      overlay.setPosition(coord);
    } else {
      overlay.setPosition(undefined);
    }
  }, [map, hoveredElevationPoint]);

  // Activity highlight layer (hovered route from popup)
  useEffect(() => {
    if (!map) return;

    if (!activityHighlightSourceRef.current) {
      const source = new VectorSource();
      const layer = new VectorLayer({
        source,
        zIndex: 6,
      });
      map.addLayer(layer);
      activityHighlightSourceRef.current = source;
      activityHighlightLayerRef.current = layer;
    }

    const source = activityHighlightSourceRef.current;
    source.clear();

    if (hoveredActivityRoute && hoveredActivityRoute.length >= 2) {
      const color = hoveredActivityColor ?? DEFAULT_SPORT_COLOR;
      const coords = hoveredActivityRoute.map((coord) => fromLonLat(coord, OS_PROJECTION.code));
      const feature = new Feature({ geometry: new LineString(coords) });
      feature.setStyle([
        new Style({ stroke: new Stroke({ color: hexToRgba(color, 0.45), width: 8 }) }),
        new Style({ stroke: new Stroke({ color: hexToRgba(color, 0.85), width: 4 }) }),
      ]);
      source.addFeature(feature);
    }
  }, [map, hoveredActivityRoute, hoveredActivityColor]);

  // Cleanup hover layer + overlay on unmount
  useEffect(() => {
    return () => {
      if (map) {
        if (hoverLayerRef.current) {
          map.removeLayer(hoverLayerRef.current);
          hoverLayerRef.current = null;
          hoverSourceRef.current = null;
        }
        if (hoverOverlayRef.current) {
          map.removeOverlay(hoverOverlayRef.current);
          hoverOverlayRef.current = null;
        }
        if (activityHighlightLayerRef.current) {
          map.removeLayer(activityHighlightLayerRef.current);
          activityHighlightLayerRef.current = null;
          activityHighlightSourceRef.current = null;
        }
      }
    };
  }, [map]);

  return <div ref={mapTargetRef} className="w-full h-full" />;
}
