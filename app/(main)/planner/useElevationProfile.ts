'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';
import { type ElevationPoint, haversineDistance, smoothElevation, downsampleToChartPoints } from '@/lib/elevation';

export type { ElevationPoint };

/** Interpolate points along a straight line between two waypoints at ~50m intervals. */
function interpolateSegment(a: Waypoint, b: Waypoint): Waypoint[] {
  const dist = haversineDistance(a, b);
  const INTERVAL = 50; // meters
  const numPoints = Math.max(2, Math.ceil(dist / INTERVAL) + 1);
  const points: Waypoint[] = [];
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    points.push({
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    });
  }
  return points;
}

function buildPolyline(
  waypoints: Waypoint[],
  segments: RouteSegment[]
): [number, number][] | null {
  if (waypoints.length < 2 || segments.length === 0) return null;

  const coords: [number, number][] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segCoords =
      seg.coordinates.length >= 2
        ? seg.coordinates
        : interpolateSegment(waypoints[i], waypoints[i + 1]);

    if (!segCoords || segCoords.length < 2) continue;

    for (let j = 0; j < segCoords.length; j++) {
      // Skip first point of subsequent segments (overlap with previous segment end)
      if (i > 0 && j === 0) continue;
      coords.push([segCoords[j].lng, segCoords[j].lat]);
    }
  }

  return coords.length >= 2 ? coords : null;
}

export function useElevationProfile(
  waypoints: Waypoint[],
  segments: RouteSegment[]
) {
  const [elevationData, setElevationData] = useState<ElevationPoint[] | null>(
    null
  );
  const [isFetching, setIsFetching] = useState(false);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if any segments are still pending routing (snapped but no coordinates)
  const hasPendingSegments = segments.some(
    (seg) => seg.snapped && seg.coordinates.length === 0
  );

  const polyline = useMemo(
    () => (hasPendingSegments ? null : buildPolyline(waypoints, segments)),
    [waypoints, segments, hasPendingSegments]
  );

  // Stable key for the polyline to avoid refetching identical routes
  const polylineKey = useMemo(
    () => (polyline ? JSON.stringify(polyline) : null),
    [polyline]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!polylineKey || !polyline) {
      // Only clear data if the route is actually gone (< 2 waypoints).
      // If segments are still routing, keep showing previous elevation data.
      if (waypoints.length < 2) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale data when route is removed
        setElevationData(null);
        setIsFetching(false);
        setSettledKey(null);
      }
      return;
    }

    debounceRef.current = setTimeout(() => {
      // Abort previous request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsFetching(true);

      fetch('/api/elevation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: polyline }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('Elevation fetch failed');
          return res.json();
        })
        .then(
          (data: {
            coordinates: { lat: number; lng: number; ele: number }[];
          }) => {
            if (!data.coordinates || data.coordinates.length === 0) {
              setElevationData(null);
              return;
            }

            // Convert to distance-based elevation profile
            let cumDist = 0;
            const points: ElevationPoint[] = data.coordinates.map((c, i) => {
              if (i > 0) {
                cumDist += haversineDistance(
                  data.coordinates[i - 1],
                  c
                );
              }
              return { distance: cumDist, ele: c.ele, lat: c.lat, lng: c.lng };
            });

            const windowSize = Math.max(5, Math.round(points.length / 40));
            const smoothed = smoothElevation(points, windowSize);
            const downsampled = downsampleToChartPoints(smoothed);

            setElevationData(downsampled);
            setSettledKey(polylineKey);
          }
        )
        .catch((err) => {
          if (err.name === 'AbortError') return;
          console.error('Elevation profile error:', err);
          setElevationData(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsFetching(false);
        });
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [polylineKey, hasPendingSegments, waypoints.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Derive loading state: true if the route has changed since the last settled
  // elevation data, or if a fetch is in flight.
  const needsElevation = waypoints.length >= 2;
  const isStale = needsElevation && (polylineKey !== settledKey || hasPendingSegments);
  const isLoading = isStale || isFetching;

  return { elevationData, isLoading };
}
