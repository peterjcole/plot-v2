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

export default function ActivityList() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const fetchIdRef = useRef(0);
  const [downloading, setDownloading] = useState<Set<number>>(new Set());

  const handleDownload = useCallback(async (activityId: number) => {
    setDownloading((prev) => new Set(prev).add(activityId));
    try {
      const res = await fetch(`/api/activity-printout?activityId=${encodeURIComponent(activityId)}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-${activityId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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

  const perPage = 20;

  useEffect(() => {
    const fetchId = ++fetchIdRef.current;
    let cancelled = false;

    async function fetchActivities() {
      try {
        const res = await fetch(`/api/activities?page=${page}&perPage=${perPage}`);
        if (cancelled) return;
        if (!res.ok) throw new Error('Failed to fetch activities');
        const data: ActivitySummary[] = await res.json();
        if (cancelled || fetchId !== fetchIdRef.current) return;
        setActivities(data);
        setHasMore(data.length === perPage);
        setError(null);
      } catch (err) {
        if (cancelled || fetchId !== fetchIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled && fetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    }

    fetchActivities();
    return () => { cancelled = true; };
  }, [page]);

  if (loading) {
    return <p className="text-zinc-500">Loading activities...</p>;
  }

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  if (activities.length === 0 && page === 1) {
    return <p className="text-zinc-500">No activities found.</p>;
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
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
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                {/* Mobile: stacked cell */}
                <td className="px-2 py-1.5 sm:hidden">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{a.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(a.startDate)} · {formatDistance(a.distance)}
                  </div>
                </td>
                {/* Desktop: separate cells */}
                <td className="hidden whitespace-nowrap px-3 py-2 text-zinc-500 sm:table-cell dark:text-zinc-400">
                  {formatDate(a.startDate)}
                </td>
                <td className="hidden px-3 py-2 font-medium text-zinc-900 sm:table-cell dark:text-zinc-100">
                  {a.name}
                </td>
                <td className="hidden px-3 py-2 text-zinc-500 sm:table-cell dark:text-zinc-400">
                  {a.type}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-right text-zinc-700 sm:table-cell dark:text-zinc-300">
                  {formatDistance(a.distance)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right text-zinc-700 sm:px-3 sm:py-2 dark:text-zinc-300">
                  {formatDuration(a.movingTime)}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-right text-zinc-700 sm:table-cell dark:text-zinc-300">
                  {a.elevationGain.toFixed(0)}m
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right sm:px-3 sm:py-2">
                  <Link
                    href={`/activity/${a.id}`}
                    className="mr-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDownload(a.id)}
                    disabled={downloading.has(a.id)}
                    aria-busy={downloading.has(a.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-300"
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
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Previous
        </button>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Page {page}
        </span>
        <button
          onClick={() => { setLoading(true); setPage((p) => p + 1); }}
          disabled={loading || !hasMore}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
