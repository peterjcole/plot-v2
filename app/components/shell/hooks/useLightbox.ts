'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { type ActivityData } from '@/lib/types';

export function useLightbox(activityDetail: ActivityData | null, selectedId: string | null) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const lightboxPhotos = useMemo(() => activityDetail?.photos ?? [], [activityDetail]);
  const lightboxOpen = lightboxIndex >= 0 && lightboxPhotos.length > 0;

  useEffect(() => { setLightboxIndex(-1); }, [selectedId]);

  const handlePhotoClick = useCallback((index: number) => setLightboxIndex(index), []);
  const handleLightboxClose = useCallback(() => setLightboxIndex(-1), []);
  const handlePhotoMarkerClick = useCallback((photoId: string) => {
    const idx = lightboxPhotos.findIndex(p => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  }, [lightboxPhotos]);

  return { lightboxIndex, lightboxPhotos, lightboxOpen, handlePhotoClick, handleLightboxClose, handlePhotoMarkerClick };
}
