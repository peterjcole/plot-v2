'use client';

import { useState, useCallback } from 'react';
import { type ActivitySummary } from '@/lib/types';

export function useActivityBrowse(initialActivities: ActivitySummary[]) {
  const [allActivities, setAllActivities] = useState(initialActivities);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialActivities.length === 50);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleLoadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/activities?page=${page + 1}&perPage=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next = await res.json() as ActivitySummary[];
      setAllActivities(prev => [...prev, ...next]);
      setPage(p => p + 1);
      setHasMore(next.length === 50);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page]);

  return { allActivities, page, isLoadingMore, hasMore, hoveredId, setHoveredId, handleLoadMore };
}
