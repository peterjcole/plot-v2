'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ActivitySummary } from '@/lib/types';

function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(1) + ' km';
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface ActivityListProps {
  initialActivities: ActivitySummary[];
}

export default function ActivityList({ initialActivities }: ActivityListProps) {
  const [activities, setActivities] = useState<ActivitySummary[]>(initialActivities);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialActivities.length === 20);
  const fetchIdRef = useRef(0);
  const [downloading, setDownloading] = useState<Set<number>>(new Set());

  const perPage = 20;

  const fetchActivities = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;

    try {
      const res = await fetch(`/api/activities?page=${page}&perPage=${perPage}`);
      if (fetchId !== fetchIdRef.current) return;
      if (!res.ok) throw new Error('Failed to fetch activities');
      const data: ActivitySummary[] = await res.json();
      if (fetchId !== fetchIdRef.current) return;
      setActivities(data);
      setHasMore(data.length === perPage);
      setError(null);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [page]);

  // Fetch activities on page change (page 1 is provided server-side)
  const initialPageRef = useRef(true);
  useEffect(() => {
    if (initialPageRef.current) {
      initialPageRef.current = false;
      return;
    }
    setLoading(true);
    fetchActivities();
  }, [fetchActivities]);

  const handleDownload = useCallback(async (activityId: number) => {
    setDownloading((prev) => new Set(prev).add(activityId));
    try {
      const res = await fetch(`/api/activity-printout?activityId=${encodeURIComponent(activityId)}&format=jpeg`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-${activityId}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <svg className="h-6 w-6 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none" aria-label="Loading activities">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="w-full">
      {activities.length === 0 && page === 1 ? (
        <p className="text-text-secondary">No activities found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  {/* Mobile: combined column */}
                  <th scope="col" className="px-2 py-1.5 sm:hidden">Activity</th>
                  {/* Desktop: separate columns */}
                  <th scope="col" className="hidden px-3 py-2 sm:table-cell">Date</th>
                  <th scope="col" className="hidden px-3 py-2 sm:table-cell">Name</th>
                  <th scope="col" className="hidden px-3 py-2 sm:table-cell">Type</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Distance</th>
                  <th scope="col" className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Time</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Elevation</th>
                  <th scope="col" className="px-2 py-1.5 sm:px-3 sm:py-2"></th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-border"
                  >
                    {/* Mobile: stacked cell */}
                    <td className="px-2 py-1.5 sm:hidden">
                      <div className="font-medium text-text-primary">{a.name}</div>
                      <div className="text-xs text-text-secondary">
                        {formatDate(a.startDate)} · {formatDistance(a.distance)}
                      </div>
                    </td>
                    {/* Desktop: separate cells */}
                    <td className="hidden whitespace-nowrap px-3 py-2 text-text-secondary sm:table-cell">
                      {formatDate(a.startDate)}
                    </td>
                    <td className="hidden px-3 py-2 font-medium text-text-primary sm:table-cell">
                      {a.name}
                    </td>
                    <td className="hidden px-3 py-2 text-text-secondary sm:table-cell">
                      {a.type}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-right text-text-secondary sm:table-cell">
                      {formatDistance(a.distance)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right text-text-secondary sm:px-3 sm:py-2">
                      {formatDuration(a.movingTime)}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-right text-text-secondary sm:table-cell">
                      {a.elevationGain.toFixed(0)}m
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right sm:px-3 sm:py-2">
                      <Link
                        href={`/activity/${a.id}`}
                        className="mr-2 text-sm font-medium text-primary hover:text-primary-light transition-colors"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDownload(a.id)}
                        disabled={downloading.has(a.id)}
                        aria-busy={downloading.has(a.id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
                      >
                        {downloading.has(a.id) && (
                          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                        {downloading.has(a.id) ? 'Generating...' : 'Download'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)); }}
              disabled={loading || page === 1}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-text-secondary">
              Page {page}
            </span>
            <button
              onClick={() => { setLoading(true); setPage((p) => p + 1); }}
              disabled={loading || !hasMore}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
