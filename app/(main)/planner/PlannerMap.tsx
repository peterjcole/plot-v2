'use client';

import { useRef, useEffect } from 'react';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
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
  addPointsEnabled: boolean;
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

export default function PlannerMap({ waypoints, dispatch, onMapReady, addPointsEnabled }: PlannerMapProps) {
  const mapTargetRef = useRef<HTMLDivElement>(null);
  const map = useOpenLayersMap(mapTargetRef);
  const waypointSourceRef = useRef<VectorSource | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointsRef = useRef(waypoints);
  const addPointsRef = useRef(addPointsEnabled);

  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

  useEffect(() => {
    addPointsRef.current = addPointsEnabled;
  }, [addPointsEnabled]);

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
      style: routeStyle,
      zIndex: 5,
    });

    map.addLayer(routeLayer);
    map.addLayer(waypointLayer);

    waypointSourceRef.current = waypointSource;
    routeSourceRef.current = routeSource;

    // Delete popup overlay
    const popupEl = document.createElement('div');
    popupEl.className = 'ol-delete-popup';
    popupEl.innerHTML = '<button class="ol-delete-btn" title="Delete waypoint">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="3 6 5 6 21 6"/>' +
      '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
      '</svg></button>';

    const deleteOverlay = new Overlay({
      element: popupEl,
      positioning: 'bottom-center',
      offset: [0, -20],
      stopEvent: true,
    });
    map.addOverlay(deleteOverlay);

    let deleteTargetIndex: number | null = null;

    const showDeletePopup = (coordinate: number[], index: number) => {
      deleteTargetIndex = index;
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
      condition: (e) => (e.originalEvent as PointerEvent).pointerType !== 'touch',
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
          navigator.vibrate?.(15);
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

    // Click handler: waypoint hit → show delete popup, empty click → hide popup + optionally add waypoint
    map.on('click', (e) => {
      // Check for waypoint hit first
      const waypointFeature = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
        layerFilter: (layer) => layer === waypointLayer,
      });
      if (waypointFeature) {
        const index = waypointFeature.get('waypointIndex') as number;
        if (typeof index === 'number') {
          const geom = waypointFeature.getGeometry() as Point;
          showDeletePopup(geom.getCoordinates(), index);
        }
        return;
      }

      // Hide popup on any non-waypoint click
      if (deleteTargetIndex !== null) {
        hideDeletePopup();
        return;
      }

      // Ignore clicks on the route line
      const routeHit = map.forEachFeatureAtPixel(e.pixel, () => true, {
        layerFilter: (layer) => layer === routeLayer,
        hitTolerance: 6,
      });
      if (routeHit) return;

      // Add waypoint only if toggle is on
      if (!addPointsRef.current) return;

      const [lng, lat] = toLonLat(e.coordinate, OS_PROJECTION.code);
      dispatch({ type: 'ADD_WAYPOINT', waypoint: { lat, lng } });
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
      });
      if (waypointHit) {
        viewport.style.cursor = 'move';
        return;
      }
      const routeHit = map.forEachFeatureAtPixel(e.pixel, () => true, {
        layerFilter: (layer) => layer === routeLayer,
        hitTolerance: 6,
      });
      if (routeHit) {
        viewport.style.cursor = 'copy';
        return;
      }
      viewport.style.cursor = addPointsRef.current ? 'crosshair' : '';
    });

    // Initial sync for waypoints loaded from localStorage before map was ready
    syncFeatures(waypointSource, routeSource, waypointsRef.current);

    onMapReady?.(map);

    return () => {
      map.removeLayer(routeLayer);
      map.removeLayer(waypointLayer);
      map.removeInteraction(waypointModify);
      map.removeInteraction(routeModify);
      map.removeOverlay(deleteOverlay);
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
