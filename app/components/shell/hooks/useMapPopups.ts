'use client';

import { useState, useCallback } from 'react';
import { type PhotoItem, type HeatmapActivity } from '@/lib/types';

export function useMapPopups() {
  const [photoPopup, setPhotoPopup] = useState<{ photo: PhotoItem; screenX: number; screenY: number } | null>(null);
  const [clusterPhotosPopup, setClusterPhotosPopup] = useState<{ photos: PhotoItem[]; screenX: number; screenY: number } | null>(null);
  const [activityPopup, setActivityPopup] = useState<{
    activities: HeatmapActivity[];
    screenX: number;
    screenY: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [hoveredActivityRoute, setHoveredActivityRoute] = useState<[number, number][] | null>(null);
  const [hoveredActivityColor, setHoveredActivityColor] = useState<string | null>(null);

  const handleOwnerPhotoClick = useCallback(async (photo: PhotoItem, screenX: number, screenY: number) => {
    setActivityPopup(null);
    setClusterPhotosPopup(null);
    setHoveredActivityRoute(null);
    setPhotoPopup({ photo, screenX, screenY });
    try {
      const res = await fetch(`/api/tiles/activities?lat=${photo.lat}&lng=${photo.lng}`);
      if (res.ok) {
        const data = await res.json() as { id: number; route: [number, number][] }[];
        const match = data.find(a => a.id === photo.activityId) ?? data[0];
        if (match) { setHoveredActivityRoute(match.route); setHoveredActivityColor(null); }
      }
    } catch { /* ignore */ }
  }, []);

  const handleOwnerClusterPhotosClick = useCallback((photos: PhotoItem[], screenX: number, screenY: number) => {
    setActivityPopup(null);
    setPhotoPopup(null);
    setHoveredActivityRoute(null);
    setClusterPhotosPopup({ photos, screenX, screenY });
  }, []);

  const handleHeatmapClick = useCallback(async (lat: number, lng: number, screenX: number, screenY: number) => {
    if (popupLoading) return;
    if (activityPopup && Math.abs(activityPopup.lat - lat) < 0.0001 && Math.abs(activityPopup.lng - lng) < 0.0001) {
      setActivityPopup(null);
      setHoveredActivityRoute(null);
      return;
    }
    setActivityPopup({ activities: [], screenX, screenY, lat, lng });
    setPopupLoading(true);
    setHoveredActivityRoute(null);
    try {
      const res = await fetch(`/api/tiles/activities?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        setActivityPopup(prev => prev ? { ...prev, activities: data } : null);
      } else {
        setActivityPopup(null);
      }
    } catch {
      setActivityPopup(null);
    } finally {
      setPopupLoading(false);
    }
  }, [activityPopup, popupLoading]);

  return {
    photoPopup,
    setPhotoPopup,
    clusterPhotosPopup,
    setClusterPhotosPopup,
    activityPopup,
    setActivityPopup,
    popupLoading,
    hoveredActivityRoute,
    setHoveredActivityRoute,
    hoveredActivityColor,
    setHoveredActivityColor,
    handleOwnerPhotoClick,
    handleOwnerClusterPhotosClick,
    handleHeatmapClick,
  };
}
