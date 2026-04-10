'use client';

import { useState } from 'react';
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
  onFitToRoute?: () => void;
  onExportImage?: () => void;
  isExportingImage?: boolean;
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

function SnapToggle({ on, onChange, direction }: { on: boolean; onChange: () => void; direction: 'in' | 'out' }) {
  // Segment chip: dashed line → dot (in) or dot → dashed line (out)
  // Active: solid orange line + filled waypoint dot
  // Inactive: ghosted dashed line + hollow dot
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      title={direction === 'in' ? 'Snap incoming segment to roads' : 'Snap outgoing segment to roads'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 20,
        padding: 0,
        borderRadius: 3,
        border: `1px solid ${on ? 'rgba(224,112,32,0.55)' : 'var(--p3)'}`,
        background: on ? 'rgba(224,112,32,0.1)' : 'transparent',
        cursor: 'pointer',
        transition: 'border-color 0.18s, background 0.18s',
      }}
    >
      <svg width="62" height="14" viewBox="0 0 62 14" fill="none">
        {direction === 'in' ? (
          <>
            {/* Segment line flowing into waypoint */}
            <line
              x1="2" y1="7" x2="42" y2="7"
              stroke={on ? 'var(--ora)' : 'var(--fog-ghost)'}
              strokeWidth={on ? 2 : 1.5}
              strokeDasharray={on ? undefined : '3 2.5'}
              strokeLinecap="round"
            />
            {/* Arrowhead */}
            <polyline
              points="36,4 42,7 36,10"
              stroke={on ? 'var(--ora)' : 'var(--fog-ghost)'}
              strokeWidth={on ? 1.5 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Waypoint dot */}
            <circle
              cx="54" cy="7" r={on ? 4.5 : 3.5}
              fill={on ? 'var(--ora)' : 'var(--p3)'}
              stroke={on ? 'rgba(224,112,32,0.35)' : 'var(--p4)'}
              strokeWidth={on ? 2.5 : 1}
            />
          </>
        ) : (
          <>
            {/* Waypoint dot */}
            <circle
              cx="8" cy="7" r={on ? 4.5 : 3.5}
              fill={on ? 'var(--ora)' : 'var(--p3)'}
              stroke={on ? 'rgba(224,112,32,0.35)' : 'var(--p4)'}
              strokeWidth={on ? 2.5 : 1}
            />
            {/* Segment line flowing out of waypoint */}
            <line
              x1="20" y1="7" x2="58" y2="7"
              stroke={on ? 'var(--ora)' : 'var(--fog-ghost)'}
              strokeWidth={on ? 2 : 1.5}
              strokeDasharray={on ? undefined : '3 2.5'}
              strokeLinecap="round"
            />
            {/* Arrowhead */}
            <polyline
              points="52,4 58,7 52,10"
              stroke={on ? 'var(--ora)' : 'var(--fog-ghost)'}
              strokeWidth={on ? 1.5 : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}

export default function PlannerPanel({ distance, elevGain, waypoints, segments, elevationData, isLoadingElevation, dispatch, onFitToRoute, onExportImage, isExportingImage = false }: PlannerPanelProps) {
  const hasRoute = waypoints.length >= 2;
  const [hoverX, setHoverX] = useState<number | null>(null);

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
            const snapInOn = i > 0 ? (segments[i - 1]?.snapped ?? false) : false;
            const snapOutOn = i < waypoints.length - 1 ? (segments[i]?.snapped ?? false) : false;
            return (
              <div
                key={i}
                role="listitem"
                onMouseEnter={() => setHoverX(i)}
                onMouseLeave={() => setHoverX(null)}
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

                {/* Snap toggles — labeled pill toggles, stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0, width: 72, opacity: hoverX === i || snapInOn || snapOutOn ? 1 : 0.3, transition: 'opacity 0.15s ease' }}>
                  {i > 0 && (
                    <SnapToggle on={snapInOn} direction="in" onChange={() => dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index: i - 1 })} />
                  )}
                  {i < waypoints.length - 1 && (
                    <SnapToggle on={snapOutOn} direction="out" onChange={() => dispatch({ type: 'TOGGLE_SEGMENT_SNAP', index: i })} />
                  )}
                </div>

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
