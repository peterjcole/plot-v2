'use client';

import { useCallback, useMemo, useRef } from 'react';
import { RouteAction } from './useRouteHistory';
import { downloadGpx, parseGpx, selectGpxWaypoints } from '@/lib/gpx';
import { Waypoint, RouteSegment } from '@/lib/types';
import type { ElevationPoint } from './useElevationProfile';

interface PlannerToolbarProps {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distance: number;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: React.Dispatch<RouteAction>;
  onGeolocate: () => void;
  addPointsEnabled: boolean;
  onToggleAddPoints: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  elevationData: ElevationPoint[] | null;
  isLoadingElevation: boolean;
  onElevationHover?: (point: { lat: number; lng: number; ele: number; distance: number } | null) => void;
  onFitToRoute?: (waypoints: Waypoint[]) => void;
  onExportImage?: () => void;
  isExportingImage?: boolean;
  onBack?: () => void;
  isMobile?: boolean;
  onToggleLayers?: () => void;
  onExportGpx?: () => void;
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

const SEP = (
  <div style={{ width: 1, height: 24, background: 'var(--p3)', margin: '0 4px', flexShrink: 0 }} />
);

interface TbBtnProps {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}
function TbBtn({ label, disabled, active, onClick, children, title }: TbBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      style={{
        width: 40, height: 36, borderRadius: 3,
        background: 'transparent', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        color: active ? 'var(--ora)' : 'var(--fog)',
        opacity: disabled ? 0.28 : 1,
        flexShrink: 0,
      }}
    >
      {children}
      <span style={{ font: '600 9px/1 var(--mono)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'inherit' }}>
        {label}
      </span>
    </button>
  );
}

export default function PlannerToolbar({
  waypoints,
  segments,
  distance,
  canUndo,
  canRedo,
  dispatch,
  onGeolocate,
  snapEnabled,
  onToggleSnap,
  elevationData,
  onFitToRoute,
  onExportImage,
  isExportingImage = false,
  onBack,
  isMobile = false,
  onToggleLayers,
  onExportGpx,
}: PlannerToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const elevGain = useMemo(() => {
    if (!elevationData || elevationData.length < 2) return null;
    let gain = 0;
    for (let i = 1; i < elevationData.length; i++) {
      const delta = elevationData[i].ele - elevationData[i - 1].ele;
      if (delta > 0) gain += delta;
    }
    return Math.round(gain);
  }, [elevationData]);

  const handleUndo = useCallback(() => dispatch({ type: 'UNDO' }), [dispatch]);
  const handleRedo = useCallback(() => dispatch({ type: 'REDO' }), [dispatch]);

  const handleClear = useCallback(() => {
    if (waypoints.length === 0) return;
    if (window.confirm('Clear the entire route?')) dispatch({ type: 'CLEAR' });
  }, [waypoints.length, dispatch]);

  const handleExportGpx = useCallback(() => {
    if (onExportGpx) { onExportGpx(); return; }
    if (waypoints.length === 0) return;
    downloadGpx(waypoints, segments);
  }, [onExportGpx, waypoints, segments]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (waypoints.length > 0 && !window.confirm('Replace the current route with the imported GPX?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== 'string') return;
      const trackPoints = parseGpx(content);
      const { waypoints: viaPoints, segments: viaSegments } = selectGpxWaypoints(trackPoints, 2);
      if (viaPoints.length >= 1) {
        dispatch({ type: 'LOAD', waypoints: viaPoints, segments: viaSegments });
        onFitToRoute?.(viaPoints);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [waypoints.length, dispatch, onFitToRoute]);

  const hasRoute = waypoints.length >= 2;

  const routeInfo = hasRoute
    ? `${fmtDist(distance)}${elevGain != null ? ` · ${elevGain} m ↑` : ''}`
    : null;

  return (
    <>
      <input type="file" accept=".gpx" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
      <div style={{
        position: isMobile ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, height: isMobile ? 60 : 48,
        background: 'var(--glass-hvy)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--p3)',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 2,
        zIndex: isMobile ? 20 : 5,
      } as React.CSSProperties}>

        {isMobile && (
          <>
            <span style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'rgba(240,248,250,0.9)', padding: '0 8px', flexShrink: 0, lineHeight: 1 }}>plot</span>
            {SEP}
          </>
        )}

        {/* Undo */}
        <TbBtn label="Undo" disabled={!canUndo} onClick={handleUndo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
          </svg>
        </TbBtn>
        {/* Redo */}
        <TbBtn label="Redo" disabled={!canRedo} onClick={handleRedo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>
          </svg>
        </TbBtn>

        {SEP}

        {/* Snap toggle */}
        <TbBtn label="Snap" active={snapEnabled} onClick={onToggleSnap}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </TbBtn>

        {/* Clear */}
        <TbBtn label="Clear" disabled={waypoints.length === 0} onClick={handleClear}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </TbBtn>

        {!isMobile && (
          <>
            {SEP}

            {/* Import */}
            <TbBtn label="Import" onClick={() => fileInputRef.current?.click()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </TbBtn>

            {/* Export GPX */}
            <TbBtn label="Export" disabled={!hasRoute} onClick={handleExportGpx}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </TbBtn>

            {/* Export Image */}
            <TbBtn label="Image" disabled={!hasRoute || isExportingImage} onClick={onExportImage}>
              {isExportingImage ? (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(240,248,250,0.45)', borderTopColor: 'var(--ora)', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              )}
            </TbBtn>
          </>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {!isMobile && (
          <>
            {/* Route info or hint */}
            {routeInfo ? (
              <div style={{ font: '600 10px/1 var(--mono)', color: 'rgba(240,248,250,0.72)', letterSpacing: '.06em', padding: '0 12px', whiteSpace: 'nowrap' }}>
                {routeInfo}
              </div>
            ) : (
              <div style={{ font: '400 10px/1 var(--mono)', color: 'rgba(240,248,250,0.45)', letterSpacing: '.04em', padding: '0 12px', whiteSpace: 'nowrap' }}>
                Click the map to place your first point
              </div>
            )}

            {SEP}
          </>
        )}

        {/* Layers (mobile only) */}
        {isMobile && onToggleLayers && (
          <TbBtn label="Layers" onClick={onToggleLayers}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </TbBtn>
        )}

        {/* Locate */}
        <TbBtn label="Locate" onClick={onGeolocate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        </TbBtn>

        {/* Back (desktop only, when onBack provided) */}
        {!isMobile && onBack && (
          <>
            {SEP}
            <TbBtn label="Back" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </TbBtn>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
