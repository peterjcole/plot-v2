'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Download } from 'lucide-react';
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

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function formatKm(m: number): string {
  return (m / 1000).toFixed(1);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--fog-dim)',
  fontFamily: 'var(--mono)',
};

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ice)', fontFamily: 'var(--mono)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
        {value}
        {unit && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--fog-dim)', marginLeft: 3 }}>{unit}</span>}
      </div>
      <div style={{ ...LABEL_STYLE, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function BeaconTrackingClient({ token, initial }: BeaconTrackingClientProps) {
  const [data, setData] = useState<BeaconPublicData>(initial);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [fetchError, setFetchError] = useState(false);
  // Lazy-initialized straight from matchMedia (house pattern, see
  // useTheme.ts) rather than a default + effect-set — the recipient has
  // never visited plot, so there's no 'plot-theme' localStorage choice to
  // read, just their system preference, available synchronously on mount.
  const [osDark, setOsDark] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches));
  // Matches the `md:` breakpoint (768px) that switches the card from a
  // bottom sheet to a top-left panel.
  const [isDesktop, setIsDesktop] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches));

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

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const trail: [number, number][] = data.pings.map((p) => [p.lat, p.lng]);
  const lastPing = data.pings.at(-1) ?? null;
  const current: [number, number] | null = lastPing ? [lastPing.lat, lastPing.lng] : null;

  const staleMs = lastPing ? now - Date.parse(lastPing.recordedAt) : null;
  const staleness: 'fresh' | 'amber' | 'red' =
    staleMs === null ? 'fresh' : staleMs > STALE_RED_MS ? 'red' : staleMs > STALE_AMBER_MS ? 'amber' : 'fresh';
  const statusColor = { fresh: 'var(--grn)', amber: 'var(--ora)', red: 'var(--red)' }[staleness];
  const isLive = !data.endedAt && staleness !== 'red';

  const distanceDoneM = lastPing?.distanceM ?? null;
  const distanceRemainingM = lastPing?.distanceRemainingM ?? null;
  const ascentRemainingM = lastPing?.ascentRemainingM ?? null;
  const elapsedS = lastPing?.elapsedS ?? (data.startedAt ? (Date.parse(data.endedAt ?? new Date(now).toISOString()) - Date.parse(data.startedAt)) / 1000 : null);

  // Cheap arithmetic on a few numbers — not worth memoizing.
  const progress =
    distanceDoneM !== null && distanceRemainingM !== null && distanceDoneM + distanceRemainingM > 0
      ? Math.min(1, distanceDoneM / (distanceDoneM + distanceRemainingM))
      : distanceDoneM !== null && data.routeDistanceM
        ? Math.min(1, distanceDoneM / data.routeDistanceM)
        : null;

  // The card floats over the map — keep the bounds fit clear of it so the
  // live point never lands underneath it. Numbers match the card's own
  // position: a left panel on desktop, a bottom sheet on mobile.
  const cardPadding: [number, number, number, number] = isDesktop ? [80, 40, 40, 340] : [40, 40, 260, 40];

  if (fetchError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-p0 px-6 text-center font-mono">
        <div className="font-logo text-3xl text-ice mb-3">plot</div>
        <p className="text-ice text-base">This tracking link has expired</p>
        <p className="mt-2 text-fog text-sm max-w-xs">
          Beacon links stay live for 24 hours after a workout finishes, then close on their own.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-p0 font-mono">
      <BeaconMap route={routeLine} trail={trail} current={current} ended={!!data.endedAt} osDark={osDark} activity={data.activity} cardPadding={cardPadding} />

      {/* Wordmark — the only place this page uses the display face; the
          route name below is plain mono, on purpose. */}
      <div className="absolute left-4 top-4 md:left-5 md:top-5 font-logo text-xl text-ice pointer-events-none drop-shadow-[0_1px_3px_rgba(7,14,20,0.5)]">
        plot
      </div>

      {/* Status card: fixed top-left on desktop, a bottom sheet on mobile. */}
      <div
        className="absolute z-10 flex flex-col gap-3 border border-p3 bg-glass p-4
                   inset-x-0 bottom-0 rounded-t-2xl pb-[calc(16px+env(safe-area-inset-bottom))]
                   md:inset-x-auto md:bottom-auto md:left-5 md:top-16 md:w-[300px] md:rounded-lg"
        style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-ice text-lg font-semibold leading-tight" style={{ letterSpacing: '-0.01em' }}>
              {data.routeName || activityLabel(data.activity)}
            </div>
            <div className="mt-1 text-fog text-sm">
              {data.endedAt ? (
                `Finished ${formatClock(data.endedAt)}`
              ) : (
                <>
                  {activityLabel(data.activity)} in progress
                  {data.routeReversed ? ' · reversed' : ''}
                </>
              )}
            </div>
          </div>
          {/* `flex items-center justify-center` (not `inset-0` on the ring)
              is what keeps the ring centered as it grows: an absolutely
              positioned element with no inset values takes its *static*
              position from the flex alignment, and that gets recomputed
              each frame as its animated width/height change. Pinning it
              with `inset-0` plus a manual offset (the previous approach)
              fixes its top-left corner instead, so it visibly drifted off
              -center as it expanded. Same fix as the map's own live-location
              marker, which already used this correctly. */}
          <div className="relative mt-1.5 h-2.5 w-2.5 shrink-0 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: statusColor, boxShadow: `0 0 0 2px var(--glass)` }}
            />
            {isLive && <div className="absolute rounded-full border border-ora animate-contour-ping" />}
          </div>
        </div>

        {progress !== null && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-fog-ghost">
            <div className="h-full rounded-full bg-ora" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        {(distanceDoneM !== null || distanceRemainingM !== null || ascentRemainingM !== null || elapsedS !== null) && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {distanceDoneM !== null && <Stat label="Done" value={formatKm(distanceDoneM)} unit="km" />}
            {distanceRemainingM !== null && <Stat label="To go" value={formatKm(distanceRemainingM)} unit="km" />}
            {ascentRemainingM !== null && ascentRemainingM > 0 && <Stat label="Climb left" value={Math.round(ascentRemainingM).toString()} unit="m" />}
            {elapsedS !== null && <Stat label="Elapsed" value={formatDuration(elapsedS)} />}
          </div>
        )}

        <div className="border-t border-fog-ghost pt-3 flex flex-col gap-2">
          <p className="text-sm font-medium" style={{ color: statusColor }}>
            {lastPing ? `Updated ${formatAgo(lastPing.recordedAt, now)}` : 'Waiting for first location'}
          </p>
          {data.hasGpx && (
            <a
              href={`/api/beacon/${encodeURIComponent(token)}/gpx`}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-sm border border-ice/20 py-2.5 px-3 text-xs font-mono uppercase tracking-[0.06em] text-ice no-underline"
            >
              <Download size={13} strokeWidth={2} aria-hidden="true" />
              Download planned route
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
