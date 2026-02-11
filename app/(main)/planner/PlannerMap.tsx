'use client';

import { useRef, useEffect } from 'react';
import Map from 'ol/Map';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Circle as CircleStyle, Fill, Stroke, Icon } from 'ol/style';
import { DragPan, Modify } from 'ol/interaction';
import { fromLonLat, toLonLat } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import { useOpenLayersMap } from './useOpenLayersMap';
import { RouteAction } from './useRouteHistory';
import { Waypoint, RouteSegment } from '@/lib/types';
import { OS_PROJECTION } from '@/lib/map-config';

interface PlannerMapProps {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  dispatch: React.Dispatch<RouteAction>;
  onMapReady?: (map: Map) => void;
  addPointsEnabled: boolean;
  snapEnabled: boolean;
  heatmapEnabled: boolean;
  heatmapSport: string;
  heatmapColor: string;
  dimBaseMap: boolean;
  hoveredElevationPoint?: { lat: number; lng: number; ele: number; distance: number } | null;
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
  heatmapEnabled,
  heatmapSport,
  heatmapColor,
  dimBaseMap,
  hoveredElevationPoint,
}: PlannerMapProps) {
  const mapTargetRef = useRef<HTMLDivElement>(null);
  const map = useOpenLayersMap(mapTargetRef);
  const waypointSourceRef = useRef<VectorSource | null>(null);
  const routeSourceRef = useRef<VectorSource | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waypointsRef = useRef(waypoints);
  const segmentsRef = useRef(segments);
  const addPointsRef = useRef(addPointsEnabled);
  const snapEnabledRef = useRef(snapEnabled);
  const heatmapLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const dimLayerRef = useRef<TileLayer<XYZ> | null>(null);
  const hoverSourceRef = useRef<VectorSource | null>(null);
  const hoverLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const hoverOverlayRef = useRef<Overlay | null>(null);

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

    if (!heatmapEnabled || !dimBaseMap) return;

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
  }, [map, heatmapEnabled, dimBaseMap]);

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
        return;
      }

      // Hide popups on any non-waypoint click
      const hadPopup = deleteTargetIndex !== null || insertCoord !== null;
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
      }
    };
  }, [map]);

  return <div ref={mapTargetRef} className="w-full h-full" />;
}
