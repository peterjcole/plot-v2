'use client';

import { useState, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import Map from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import { type Waypoint, type RouteSegment } from '@/lib/types';
import { type RouteAction } from '@/app/(main)/planner/useRouteHistory';
import { type WaypointClickInfo, type SegmentTapInfo } from '@/app/components/MainMap';
import { OS_PROJECTION } from '@/lib/map-config';

export function useWaypointInteraction(
  waypoints: Waypoint[],
  segments: RouteSegment[],
  dispatch: React.Dispatch<RouteAction>,
  mapInstanceRef: RefObject<Map | null>,
) {
  const [waypointPopover, setWaypointPopover] = useState<WaypointClickInfo | null>(null);
  const [segmentTap, setSegmentTap] = useState<SegmentTapInfo | null>(null);

  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const handleWaypointClick = useCallback((info: WaypointClickInfo) => setWaypointPopover(info), []);
  const handleSegmentTap = useCallback((info: SegmentTapInfo) => setSegmentTap(info), []);

  const handleSegmentInsert = useCallback(() => {
    const tap = segmentTap;
    if (!tap) return;
    dispatch({ type: 'INSERT_WAYPOINT', index: tap.segmentIndex, waypoint: tap.waypoint, snap: false });
    setSegmentTap(null);
  }, [segmentTap, dispatch]);

  const handleWaypointPopoverClose = useCallback(() => setWaypointPopover(null), []);

  const handleEditWaypoint = useCallback((index: number) => {
    const wp = waypointsRef.current[index];
    const map = mapInstanceRef.current;
    if (!wp || !map) return;
    const coord = fromLonLat([wp.lng, wp.lat], OS_PROJECTION.code);

    const showPopover = () => {
      const px = map.getPixelFromCoordinate(coord);
      if (!px) return;
      const rect = map.getTargetElement().getBoundingClientRect();
      setWaypointPopover({ index, screenX: rect.left + px[0], screenY: rect.top + px[1] });
    };

    const size = map.getSize();
    const pixel = map.getPixelFromCoordinate(coord);
    const offscreen = !pixel || !size ||
      pixel[0] < 0 || pixel[1] < 0 || pixel[0] > size[0] || pixel[1] > size[1];

    if (offscreen) {
      map.getView().animate({ center: coord, duration: 300 }, showPopover);
    } else {
      showPopover();
    }
  }, [mapInstanceRef]);

  const handleWaypointDelete = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_WAYPOINT', index });
    setWaypointPopover(null);
  }, [dispatch]);

  const handleToggleSnapIn = useCallback((index: number) => {
    if (index > 0) dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index: index - 1 });
  }, [dispatch]);

  const handleToggleSnapOut = useCallback((index: number) => {
    if (index < segmentsRef.current.length) dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index });
  }, [dispatch]);

  return {
    waypointPopover,
    setWaypointPopover,
    segmentTap,
    setSegmentTap,
    handleWaypointClick,
    handleSegmentTap,
    handleSegmentInsert,
    handleWaypointPopoverClose,
    handleEditWaypoint,
    handleWaypointDelete,
    handleToggleSnapIn,
    handleToggleSnapOut,
  };
}
