'use client';

import { Waypoint, RouteSegment } from '@/lib/types';
import { type ElevationPoint } from '@/app/(main)/planner/useElevationProfile';
import { type RouteAction } from '@/app/(main)/planner/useRouteHistory';
import { downloadGpx } from '@/lib/gpx';
import ElevationChart, { type ElevationHoverPoint } from '@/app/(main)/planner/ElevationChart';

interface PlannerPanelProps {
  distance: number;
  elevGain: number;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  elevationData: ElevationPoint[] | null;
  isLoadingElevation: boolean;
  dispatch: React.Dispatch<RouteAction>;
  onFitToRoute?: () => void;
  onExportImage?: () => void;
  isExportingImage?: boolean;
  onEditWaypoint?: (index: number) => void;
  onElevationHover?: (point: ElevationHoverPoint | null) => void;
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


export default function PlannerPanel({ distance, elevGain, waypoints, segments, elevationData, isLoadingElevation, dispatch, onFitToRoute, onExportImage, isExportingImage = false, onEditWaypoint, onElevationHover }: PlannerPanelProps) {
  const hasRoute = waypoints.length >= 2;

  function handleExportGpx() {
    if (waypoints.length < 2) return;
    downloadGpx(waypoints, segments, 'route');
  }

  return (
    <>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '12px 14px 0' }}>

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

            {/* Elevation chart */}
            {isLoadingElevation && (
              <div style={{ fontSize: 9, color: 'var(--fog-ghost)', fontFamily: 'var(--mono)', marginTop: 8 }}>
                Loading elevation…
              </div>
            )}
            {elevationData && !isLoadingElevation && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--fog-ghost)', paddingTop: 8 }}>
                <ElevationChart data={elevationData} onHover={onElevationHover} />
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', lineHeight: 1.7, marginBottom: 16 }}>
            Click the map to add waypoints. Use the toolbar to undo, snap to roads, and export your route.
          </p>
        )}

        {/* Waypoints header */}
        {waypoints.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', flex: 1 }}>
              Waypoints
            </span>
            <span style={{ fontSize: 9, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
              {waypoints.length}
            </span>
            {waypoints.length >= 2 && onFitToRoute && (
              <button
                onClick={onFitToRoute}
                title="Fit map to route"
                aria-label="Fit map to route"
                style={{
                  background: 'none', border: '1px solid var(--fog-ghost)', borderRadius: 3,
                  padding: '2px 4px', cursor: 'pointer', color: 'var(--fog-dim)',
                  display: 'flex', alignItems: 'center', lineHeight: 0,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h6M3 3v6M21 3h-6M21 3v6M3 21h6M3 21v-6M21 21h-6M21 21v-6"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Waypoints list — fills remaining height */}
      {waypoints.length > 0 && (
        <div
          role="list"
          style={{ flex: 1, overflowY: 'auto', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {waypoints.map((wp, i) => {
            return (
              <div
                key={i}
                role="listitem"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 0',
                  borderBottom: '1px solid var(--fog-ghost)',
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
                <span style={{ flex: 1, fontSize: 10, color: 'var(--fog)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {wp.name ?? `Waypoint ${i + 1}`}
                </span>

                <button
                  onClick={() => onEditWaypoint?.(i)}
                  aria-label={`Edit waypoint ${i + 1}`}
                  style={{
                    background: 'none', border: 'none', padding: '2px',
                    color: 'var(--fog-dim)', cursor: 'pointer', lineHeight: 0, flexShrink: 0,
                    opacity: 0.8,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>

                <button
                  onClick={() => dispatch({ type: 'REMOVE_WAYPOINT', index: i })}
                  aria-label={`Remove waypoint ${i + 1}`}
                  style={{
                    background: 'none', border: 'none', padding: '2px',
                    color: 'var(--fog-dim)', cursor: 'pointer', lineHeight: 0, flexShrink: 0,
                    opacity: 0.8,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer — Export buttons */}
      {hasRoute && (
        <div style={{ padding: '10px 14px 14px', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button
            onClick={handleExportGpx}
            style={{
              flex: 1, padding: '9px 10px',
              background: 'var(--p3)', border: '1px solid var(--fog-ghost)', borderRadius: 4,
              color: 'var(--fog)', fontFamily: 'var(--mono)', fontSize: 10,
              fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            GPX
          </button>
          {onExportImage && (
            <button
              onClick={onExportImage}
              disabled={isExportingImage}
              style={{
                flex: 1, padding: '9px 10px',
                background: 'var(--ora)', border: 'none', borderRadius: 4,
                color: 'var(--p0)', fontFamily: 'var(--mono)', fontSize: 10,
                fontWeight: 600, cursor: isExportingImage ? 'wait' : 'pointer', letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                opacity: isExportingImage ? 0.6 : 1,
              }}
            >
              {isExportingImage ? (
                <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(7,14,20,0.4)', borderTopColor: 'var(--p0)', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              )}
              Image
            </button>
          )}
        </div>
      )}
    </div>
    </>
  );
}
