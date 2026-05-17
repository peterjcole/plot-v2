'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { type ElevationPoint, haversineDistance, smoothElevation, downsampleToChartPoints } from '@/lib/elevation';

export function useActivityElevationProfile(route: [number, number][] | undefined) {
  const [elevationData, setElevationData] = useState<ElevationPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Activity route is [lat, lng]; elevation API expects [lng, lat]
  const coordinates = useMemo(
    () => (route && route.length >= 2 ? route.map(([lat, lng]) => [lng, lat] as [number, number]) : null),
    [route]
  );

  const coordsKey = useMemo(() => (coordinates ? JSON.stringify(coordinates) : null), [coordinates]);

  useEffect(() => {
    if (!coordinates || !coordsKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale data when route is removed
      setElevationData(null);
      setIsLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    fetch('/api/elevation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Elevation fetch failed');
        return res.json();
      })
      .then((data: { coordinates: { lat: number; lng: number; ele: number }[] }) => {
        if (!data.coordinates || data.coordinates.length === 0) {
          setElevationData(null);
          return;
        }
        let cumDist = 0;
        const points: ElevationPoint[] = data.coordinates.map((c, i) => {
          if (i > 0) cumDist += haversineDistance(data.coordinates[i - 1], c);
          return { distance: cumDist, ele: c.ele, lat: c.lat, lng: c.lng };
        });
        const windowSize = Math.max(5, Math.round(points.length / 40));
        const smoothed = smoothElevation(points, windowSize);
        setElevationData(downsampleToChartPoints(smoothed));
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Activity elevation profile error:', err);
        setElevationData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [coordsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { elevationData, isLoading };
}
