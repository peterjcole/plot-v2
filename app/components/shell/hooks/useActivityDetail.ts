'use client';

import { useState, useEffect } from 'react';
import { type ActivityData } from '@/lib/types';

export function useActivityDetail(selectedId: string | null) {
  const [activityDetail, setActivityDetail] = useState<ActivityData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) { setActivityDetail(null); setDetailLoading(false); return; }
    setDetailLoading(true);
    const controller = new AbortController();
    fetch(`/api/activities/${selectedId}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: ActivityData) => { setActivityDetail(data); setDetailLoading(false); })
      .catch((err) => { if (err.name !== 'AbortError') setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId]);

  return { activityDetail, setActivityDetail, detailLoading };
}
