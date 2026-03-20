'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Loader2 } from 'lucide-react';
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

function PhotoCountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-text-secondary">
      <Camera className="h-3 w-3" aria-hidden="true" />
      {count}
    </span>
  );
}

interface ActivityListProps {
  initialActivities: ActivitySummary[];
  initialPage?: number;
}

export default function ActivityList({ initialActivities, initialPage = 1 }: ActivityListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activities, setActivities] = useState<ActivitySummary[]>(initialActivities);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialActivities.length === 50);
  const fetchIdRef = useRef(0);

  const perPage = 50;

  // Sync page to URL
  useEffect(() => {
    const urlPage = parseInt(searchParams.get('page') ?? '1', 10) || 1;
    if (page === urlPage) return;
    if (page === 1) {
      router.replace('/', { scroll: false });
    } else {
      router.replace(`?page=${page}`, { scroll: false });
    }
  }, [page, router, searchParams]);

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

  if (error) {
    return <p className="text-red-600">Error: {error}</p>;
  }

  return (
    <div className="w-full">
      {activities.length === 0 && page === 1 && !loading ? (
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
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Photos</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Time</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Elevation</th>
                  <th scope="col" className="px-2 py-1.5 sm:px-3 sm:py-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-text-secondary" aria-label="Loading activities" />
                    </td>
                  </tr>
                ) : (
                  activities.map((a) => (
                    <tr key={a.id} className="border-b border-border">
                      {/* Mobile: stacked cell */}
                      <td className="py-2.5 pl-2 pr-1 sm:hidden">
                        <div className="font-medium text-text-primary">{a.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-secondary">
                          <span>{formatDate(a.startDate)}</span>
                          <span>·</span>
                          <span>{formatDistance(a.distance)}</span>
                          <span>·</span>
                          <span>{formatDuration(a.movingTime)}</span>
                          <PhotoCountBadge count={a.photoCount} />
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
                      <td className="hidden px-3 py-2 text-right sm:table-cell">
                        <PhotoCountBadge count={a.photoCount} />
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-right text-text-secondary sm:table-cell">
                        {formatDuration(a.movingTime)}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-right text-text-secondary sm:table-cell">
                        {a.elevationGain.toFixed(0)}m
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right sm:px-3">
                        <Link
                          href={`/activity/${a.id}`}
                          className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
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
