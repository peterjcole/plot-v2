'use client';

import { Waypoint, RouteSegment } from '@/lib/types';
import { type ElevationPoint } from '@/app/(main)/planner/useElevationProfile';
import { type RouteAction } from '@/app/(main)/planner/useRouteHistory';
import { downloadGpx } from '@/lib/gpx';

interface PlannerPanelProps {
  distance: number;
  elevGain: number;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  elevationData: ElevationPoint[] | null;
  isLoadingElevation: boolean;
  dispatch: React.Dispatch<RouteAction>;
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function fmtTime(meters: number): string {
  const hours = meters / 1000 / 4.5;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', fontWeight: 400 }}>
        {label}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ice)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

function ElevationSparkline({ data }: { data: ElevationPoint[] }) {
  if (data.length < 2) return null;

  const eles = data.map(p => p.ele);
  const minE = Math.min(...eles);
  const maxE = Math.max(...eles);
  const rangeE = maxE - minE || 1;
  const totalD = data[data.length - 1].distance || 1;

  const toX = (d: number) => (d / totalD) * 100;
  const toY = (e: number) => 38 - ((e - minE) / rangeE) * 34;

  const pts = data.map(p => `${toX(p.distance).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ');
  const fillPath = `M0,38 L${pts.split(' ').map(pt => pt).join(' L')} L100,38 Z`;
  const meanY = toY(eles.reduce((a, b) => a + b, 0) / eles.length);
  const peakIdx = eles.indexOf(maxE);
  const peakX = toX(data[peakIdx].distance);
  const peakLabel = maxE >= 1000 ? `${(maxE / 1000).toFixed(1)}km` : `${Math.round(maxE)}m`;

  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 40, display: 'block' }}>
      <defs>
        <linearGradient id="elev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ora)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--ora)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Fill */}
      <path d={fillPath} fill="url(#elev-fill)" />
      {/* Stroke */}
      <polyline points={pts} fill="none" stroke="var(--ora)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Mean guide */}
      <line x1="0" y1={meanY} x2="100" y2={meanY} stroke="var(--fog-ghost)" strokeWidth="0.8" strokeDasharray="2 2" />
      {/* Peak dot */}
      <circle cx={peakX} cy={toY(maxE)} r="2" fill="var(--ora)" />
      {/* Peak label */}
      <text
        x={Math.min(peakX + 2, 80)} y={toY(maxE) - 3}
        fontSize="4" fontFamily="IBM Plex Mono" fill="var(--fog-dim)"
        textAnchor={peakX > 80 ? 'end' : 'start'}
      >{peakLabel}</text>
    </svg>
  );
}

export default function PlannerPanel({ distance, elevGain, waypoints, segments, elevationData, isLoadingElevation, dispatch }: PlannerPanelProps) {
  const hasRoute = waypoints.length >= 2;

  function handleExportGpx() {
    if (waypoints.length < 2) return;
    downloadGpx(waypoints, segments, 'route');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 16px' }}>

        {/* Route stats card */}
        {hasRoute ? (
          <div style={{
            background: 'var(--p2)',
            border: '1px solid var(--fog-ghost)',
            borderRadius: 6,
            padding: 12,
            marginBottom: 12,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: elevationData ? 12 : 0 }}>
              <StatCell label="Distance" value={fmtDist(distance)} />
              <StatCell label="Elevation" value={elevGain > 0 ? `+${Math.round(elevGain)} m` : '0 m'} />
              <StatCell label="Waypoints" value={String(waypoints.length)} />
              <StatCell label="Est. time" value={distance > 0 ? fmtTime(distance) : '—'} />
            </div>

            {/* Elevation sparkline */}
            {isLoadingElevation && (
              <div style={{ fontSize: 9, color: 'var(--fog-ghost)', fontFamily: 'var(--mono)', marginTop: 8 }}>
                Loading elevation…
              </div>
            )}
            {elevationData && !isLoadingElevation && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--fog-ghost)', paddingTop: 8 }}>
                <ElevationSparkline data={elevationData} />
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', lineHeight: 1.7, marginBottom: 16 }}>
            Click the map to add waypoints. Use the toolbar to undo, snap to roads, and export your route.
          </p>
        )}

        {/* Waypoints list */}
        {waypoints.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
                Waypoints
              </span>
              <span style={{ fontSize: 9, color: 'var(--fog-ghost)', fontFamily: 'var(--mono)' }}>
                {waypoints.length}
              </span>
            </div>
            <div
              role="list"
              style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              {waypoints.map((wp, i) => (
                <div
                  key={i}
                  role="listitem"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 0',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--p3)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: 'var(--fog-dim)', fontFamily: 'var(--mono)',
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ flex: 1, fontSize: 10, color: 'var(--fog)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wp.name ?? `Waypoint ${i + 1}`}
                  </span>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_WAYPOINT', index: i })}
                    aria-label={`Remove waypoint ${i + 1}`}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: 'var(--fog-ghost)', cursor: 'pointer', lineHeight: 0, flexShrink: 0,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer — Export GPX */}
      {hasRoute && (
        <div style={{ padding: '0 14px 14px', flexShrink: 0 }}>
          <button
            onClick={handleExportGpx}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'var(--ora)', border: 'none', borderRadius: 4,
              color: 'var(--p0)', fontFamily: 'var(--mono)', fontSize: 11,
              fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export GPX
          </button>
        </div>
      )}
    </div>
  );
}
