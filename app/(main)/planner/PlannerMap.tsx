'use client';

import { useRef, useEffect } from 'react';
import Map from 'ol/Map';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Circle as CircleStyle, Fill, Stroke, Text } from 'ol/style';
import { Modify } from 'ol/interaction';
import { fromLonLat, toLonLat } from 'ol/proj';
import { useOpenLayersMap } from './useOpenLayersMap';
import { RouteAction } from './useRouteHistory';
import { Waypoint } from '@/lib/types';
import { OS_PROJECTION } from '@/lib/map-config';

interface PlannerMapProps {
  waypoints: Waypoint[];
  dispatch: React.Dispatch<RouteAction>;
  onMapReady?: (map: Map) => void;
}

function waypointStyle(index: number) {
  return new Style({
    image: new CircleStyle({
      radius: 14,
      fill: new Fill({ color: '#4A5A2B' }),
      stroke: new Stroke({ color: '#FFFFFF', width: 2.5 }),
    }),
    text: new Text({
      text: String(index + 1),
      fill: new Fill({ color: '#FFFFFF' }),
      font: 'bold 12px sans-serif',
      offsetY: 1,
    }),
  });
}

const routeStyle = new Style({
  stroke: new Stroke({
    color: '#4A5A2B',
    width: 4,
    lineDash: [8, 6],
  }),
});

function findNearestSegmentIndex(
  coord: number[],
  waypoints: Waypoint[],
  map: Map
): number | null {
  if (waypoints.length < 2) return null;

  const pixel = map.getPixelFromCoordinate(coord);
  if (!pixel) return null;

  let bestDist = Infinity;
  let bestIndex: number | null = null;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = map.getPixelFromCoordinate(
      fromLonLat([waypoints[i].lng, waypoints[i].lat], OS_PROJECTION.code)
    );
    const b = map.getPixelFromCoordinate(
      fromLonLat([waypoints[i + 1].lng, waypoints[i + 1].lat], OS_PROJECTION.code)
    );
    if (!a || !b) continue;

    const dist = pointToSegmentDistance(pixel, a, b);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i + 1;
    }
  }

  // Only insert if click is within 20px of a segment
  return bestDist < 20 ? bestIndex : null;
}

function pointToSegmentDistance(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export default function PlannerMap({ waypoints, dispatch, onMapReady }: PlannerMapProps) {
  const mapTargetRef = useRef<HTMLDivElement>(null);
  const map = useOpenLayersMap(mapTargetRef);
  const waypointSourceRef = useRef<VectorSource | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointsRef = useRef(waypoints);
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

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
      style: routeStyle,
      zIndex: 5,
    });

    map.addLayer(routeLayer);
    map.addLayer(waypointLayer);

    waypointSourceRef.current = waypointSource;
    routeSourceRef.current = routeSource;

    // Modify interaction for dragging waypoints
    const modify = new Modify({
      source: waypointSource,
      hitDetection: true,
      style: new Style({
        image: new CircleStyle({
          radius: 16,
          fill: new Fill({ color: 'rgba(74, 90, 43, 0.5)' }),
          stroke: new Stroke({ color: '#4A5A2B', width: 2 }),
        }),
      }),
    });

    modify.on('modifyend', (e) => {
      const features = e.features.getArray();
      for (const feature of features) {
        const index = feature.get('waypointIndex') as number;
        const geom = feature.getGeometry() as Point;
        const coord = geom.getCoordinates();
        const [lng, lat] = toLonLat(coord, OS_PROJECTION.code);
        dispatch({ type: 'MOVE_WAYPOINT', index, waypoint: { lat, lng } });
      }
    });

    map.addInteraction(modify);

    // Click to add waypoint
    map.on('click', (e) => {
      // Check if clicking on an existing waypoint
      const hit = map.forEachFeatureAtPixel(e.pixel, (feature) => feature, {
        layerFilter: (layer) => layer === waypointLayer,
      });
      if (hit) return;

      const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
      const waypoint = { lat, lng };

      // Check if near an existing segment for insertion
      const insertIndex = findNearestSegmentIndex(
        e.coordinate,
        waypointsRef.current,
        map
      );
      if (insertIndex !== null) {
        dispatch({ type: 'INSERT_WAYPOINT', index: insertIndex, waypoint });
      } else {
        dispatch({ type: 'ADD_WAYPOINT', waypoint });
      }
    });

    // Right-click to delete waypoint (desktop)
    map.getViewport().addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pixel = map.getEventPixel(e);
      const feature = map.forEachFeatureAtPixel(pixel, (f) => f, {
        layerFilter: (layer) => layer === waypointLayer,
      });
      if (feature) {
        const index = feature.get('waypointIndex') as number;
        if (typeof index === 'number') {
          dispatch({ type: 'REMOVE_WAYPOINT', index });
        }
      }
    });

    // Long-press to delete waypoint (mobile)
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
          dispatch({ type: 'REMOVE_WAYPOINT', index });
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
      });
      if (waypointHit) {
        viewport.style.cursor = 'move';
        return;
      }
      const routeHit = map.forEachFeatureAtPixel(e.pixel, () => true, {
        layerFilter: (layer) => layer === routeLayer,
        hitTolerance: 6,
      });
      viewport.style.cursor = routeHit ? 'copy' : '';
    });

    onMapReady?.(map);

    return () => {
      map.removeLayer(routeLayer);
      map.removeLayer(waypointLayer);
      map.removeInteraction(modify);
      waypointSourceRef.current = null;
      routeSourceRef.current = null;
    };
  }, [map, dispatch, onMapReady]);

  // Sync waypoints to OL features
  useEffect(() => {
    const waypointSource = waypointSourceRef.current;
    const routeSource = routeSourceRef.current;
    if (!waypointSource || !routeSource) return;

    // Update waypoint features
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

    // Update route line
    routeSource.clear();
    if (waypoints.length >= 2) {
      const coords = waypoints.map((wp) =>
        fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
      );
      const lineFeature = new Feature({
        geometry: new LineString(coords),
      });
      routeSource.addFeature(lineFeature);
    }
  }, [waypoints]);

  return <div ref={mapTargetRef} className="w-full h-full" />;
}
