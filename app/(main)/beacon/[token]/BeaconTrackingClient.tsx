'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { parseGpx } from '@/lib/gpx';
import type { BeaconPublicData } from '@/lib/beacon-public';

const BeaconMap = dynamic(() => import('@/app/components/BeaconMap'), { ssr: false });

const POLL_INTERVAL_MS = 30_000;
const STALE_AMBER_MS = 15 * 60_000;
const STALE_RED_MS = 45 * 60_000;

interface BeaconTrackingClientProps {
  token: string;
  initial: BeaconPublicData;
}

function activityLabel(activity: string): string {
  return activity.charAt(0).toUpperCase() + activity.slice(1);
}

function formatAgo(fromIso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(fromIso)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export default function BeaconTrackingClient({ token, initial }: BeaconTrackingClientProps) {
  const [data, setData] = useState<BeaconPublicData>(initial);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [fetchError, setFetchError] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/beacon/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (res.status === 410 || res.status === 404) {
        setFetchError(true);
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as BeaconPublicData;
      setData(next);
      setFetchError(false);
    } catch {
      // A dropped poll just means the next tick tries again — the staleness
      // banner (driven by `lastPingAt`, not by whether polling itself is
      // succeeding) already tells the truth about how current the view is.
    }
  }, [token]);

  useEffect(() => {
    // Once a beacon has ended there's nothing new to fetch — stop rather
    // than polling forever on a tab the partner left open.
    if (data.endedAt) return;
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll, data.endedAt]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!data.hasGpx) return;
    let cancelled = false;
    fetch(`/api/beacon/${encodeURIComponent(token)}/gpx`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const waypoints = parseGpx(text);
        setRouteLine(waypoints.map((w) => [w.lat, w.lng]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, data.hasGpx]);

  const trail: [number, number][] = data.pings.map((p) => [p.lat, p.lng]);
  const lastPing = data.pings.at(-1) ?? null;
  const current: [number, number] | null = lastPing ? [lastPing.lat, lastPing.lng] : null;

  if (fetchError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-p0 px-6 text-center">
        <div>
          <p className="font-logo text-2xl text-ice">Link expired</p>
          <p className="mt-2 text-fog">This tracking link is no longer available.</p>
        </div>
      </div>
    );
  }

  const staleMs = lastPing ? now - Date.parse(lastPing.recordedAt) : null;
  const staleness: 'fresh' | 'amber' | 'red' =
    staleMs === null ? 'fresh' : staleMs > STALE_RED_MS ? 'red' : staleMs > STALE_AMBER_MS ? 'amber' : 'fresh';
  const statusColor = { fresh: 'text-grn', amber: 'text-ora', red: 'text-ora' }[staleness];

  return (
    <div className="flex min-h-screen flex-col bg-p0">
      <header className="border-b border-fog-ghost px-4 py-3">
        <p className="font-logo text-lg text-ice">
          {data.routeName ? data.routeName : activityLabel(data.activity)}
        </p>
        <p className="text-sm text-fog">
          {data.endedAt ? (
            'Finished'
          ) : (
            <>
              {activityLabel(data.activity)} in progress
              {data.routeReversed ? ' (reversed)' : ''}
            </>
          )}
        </p>
      </header>

      <div className="relative flex-1" style={{ minHeight: 320 }}>
        <BeaconMap route={routeLine} trail={trail} current={current} />
      </div>

      <footer className="space-y-2 border-t border-fog-ghost px-4 py-3">
        <p className={`text-sm font-medium ${statusColor}`}>
          {lastPing ? `Last update ${formatAgo(lastPing.recordedAt, now)}` : 'No location yet'}
        </p>
        <p className="text-xs text-fog-dim">
          This page can lag behind reality — treat it as a guide, not a guarantee. Check the time above before relying on it.
        </p>
        {data.hasGpx && (
          <a
            href={`/api/beacon/${encodeURIComponent(token)}/gpx`}
            className="inline-block rounded bg-ora px-3 py-1.5 text-sm font-medium text-white"
          >
            Download planned route (GPX)
          </a>
        )}
      </footer>
    </div>
  );
}
