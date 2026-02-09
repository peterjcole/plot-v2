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
      fill: new Fill({ color: 'rgba(74, 90, 43, 0.8)' }),
      stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.85)', width: 2.5 }),
    }),
    text: new Text({
      text: String(index + 1),
      fill: new Fill({ color: 'rgba(255, 255, 255, 0.95)' }),
      font: 'bold 12px sans-serif',
      offsetY: 1,
    }),
  });
}

const routeStyle = new Style({
  stroke: new Stroke({
    color: 'rgba(74, 90, 43, 0.8)',
    width: 3.5,
    lineDash: [6, 8],
  }),
});


function syncFeatures(
  waypointSource: VectorSource | null,
  routeSource: VectorSource | null,
  waypoints: Waypoint[]
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
    const coords = waypoints.map((wp) =>
      fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
    );
    const lineFeature = new Feature({
      geometry: new LineString(coords),
    });
    routeSource.addFeature(lineFeature);
  }
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

    // Route line modify — added FIRST so it has LOWER priority than waypoint modify.
    // Handles insert-by-dragging on line edges.
    const routeModify = new Modify({
      source: routeSource,
      pixelTolerance: 10,
      style: new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: 'rgba(74, 90, 43, 0.5)' }),
          stroke: new Stroke({ color: '#4A5A2B', width: 2 }),
        }),
      }),
    });

    routeModify.on('modifyend', (e) => {
      const feature = e.features.getArray()[0];
      if (!feature) return;
      const geom = feature.getGeometry() as LineString;
      const newCoords = geom.getCoordinates();
      const current = waypointsRef.current;

      if (newCoords.length === current.length + 1) {
        // A vertex was inserted — find which index is new
        const oldCoords = current.map((wp) =>
          fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
        );
        let insertIndex = -1;
        let j = 0;
        for (let i = 0; i < newCoords.length; i++) {
          if (
            j < oldCoords.length &&
            Math.abs(newCoords[i][0] - oldCoords[j][0]) < 1 &&
            Math.abs(newCoords[i][1] - oldCoords[j][1]) < 1
          ) {
            j++;
          } else {
            insertIndex = i;
          }
        }
        if (insertIndex >= 0) {
          const [lng, lat] = toLonLat(newCoords[insertIndex], OS_PROJECTION.code);
          dispatch({ type: 'INSERT_WAYPOINT', index: insertIndex, waypoint: { lat, lng } });
        }
      } else if (newCoords.length === current.length) {
        // An existing vertex was moved — find which one changed
        const oldCoords = current.map((wp) =>
          fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code)
        );
        for (let i = 0; i < newCoords.length; i++) {
          if (
            Math.abs(newCoords[i][0] - oldCoords[i][0]) > 1 ||
            Math.abs(newCoords[i][1] - oldCoords[i][1]) > 1
          ) {
            const [lng, lat] = toLonLat(newCoords[i], OS_PROJECTION.code);
            dispatch({ type: 'MOVE_WAYPOINT', index: i, waypoint: { lat, lng } });
          }
        }
      }
    });

    map.addInteraction(routeModify);

    // Waypoint modify — added SECOND so it has HIGHER priority.
    // When dragging a waypoint marker, this grabs it and stops propagation
    // so routeModify doesn't also try to handle the line vertex.
    const waypointModify = new Modify({
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

    waypointModify.on('modifyend', (e) => {
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

    // Click to add waypoint
    map.on('click', (e) => {
      // Ignore clicks on existing waypoints or on the route line
      const hit = map.forEachFeatureAtPixel(e.pixel, () => true, {
        layerFilter: (layer) => layer === waypointLayer || layer === routeLayer,
        hitTolerance: 6,
      });
      if (hit) return;

      const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
      dispatch({ type: 'ADD_WAYPOINT', waypoint: { lat, lng } });
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

    // Initial sync for waypoints loaded from localStorage before map was ready
    syncFeatures(waypointSource, routeSource, waypointsRef.current);

    onMapReady?.(map);

    return () => {
      map.removeLayer(routeLayer);
      map.removeLayer(waypointLayer);
      map.removeInteraction(waypointModify);
      map.removeInteraction(routeModify);
      waypointSourceRef.current = null;
      routeSourceRef.current = null;
    };
  }, [map, dispatch, onMapReady]);

  // Sync waypoints to OL features
  useEffect(() => {
    syncFeatures(waypointSourceRef.current, routeSourceRef.current, waypoints);
  }, [waypoints]);

  return <div ref={mapTargetRef} className="w-full h-full" />;
}
