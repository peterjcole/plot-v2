'use client';

import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Undo2, Redo2, MapPinPlus, Link2, Trash2, Upload, Download, ArrowRightLeft, ChevronLeft } from 'lucide-react';
import { RouteAction } from './useRouteHistory';
import { downloadGpx, parseGpx, selectGpxWaypoints } from '@/lib/gpx';
import { elevationGain } from '@/lib/elevation';
import { Waypoint, RouteSegment } from '@/lib/types';
import type { ElevationPoint } from './useElevationProfile';
import ImportRoutePopover from '@/app/components/shell/ImportRoutePopover';

interface PlannerToolbarProps {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distance: number;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: React.Dispatch<RouteAction>;
  addPointsEnabled: boolean;
  onToggleAddPoints: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  elevationData: ElevationPoint[] | null;
  isLoadingElevation: boolean;
  onElevationHover?: (point: { lat: number; lng: number; ele: number; distance: number } | null) => void;
  onFitToRoute?: (waypoints: Waypoint[]) => void;
  onReverse: () => void;
  onBack?: () => void;
  onToggleLayers?: () => void;
  onExportGpx?: () => void;
  // Called after an import (GPX file or Strava URL) replaces the route, so the caller can
  // re-run reverse geocoding against the new start point.
  onImported?: () => void;
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
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}
function TbBtn({ label, disabled, active, onClick, children, title, className }: TbBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex-1 sm:flex-none sm:w-10${className ? ` ${className}` : ''}`}
      style={{
        height: 36, borderRadius: 3,
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
  addPointsEnabled,
  onToggleAddPoints,
  snapEnabled,
  onToggleSnap,
  elevationData,
  onFitToRoute,
  onReverse,
  onBack,
  onToggleLayers,
  onExportGpx,
  onImported,
}: PlannerToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAnchor, setImportAnchor] = useState<DOMRect | null>(null);

  const elevGain = useMemo(() => {
    if (!elevationData || elevationData.length < 2) return null;
    return elevationGain(elevationData);
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
    if (waypoints.length > 0 && !window.confirm('Replace the current route with the imported route?')) {
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
        onImported?.();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [waypoints.length, dispatch, onFitToRoute, onImported]);

  const hasRoute = waypoints.length >= 2;

  const routeInfo: ReactNode = hasRoute
    ? <>{fmtDist(distance)}{elevGain != null ? <> · {elevGain} m <ArrowUp size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /></> : null}</>
    : null;

  return (
    <>
      <input type="file" accept=".gpx" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
      <div
        className="animate-panel-in fixed sm:absolute top-[68px] sm:top-0 left-[10px] sm:left-0 right-[10px] sm:right-0 h-[46px] sm:h-12 rounded-[10px] sm:rounded-none border sm:border-0 sm:border-b border-p3 z-20 sm:z-[5] flex items-center px-3 gap-0.5 sm:gap-2"
        style={{ background: 'var(--glass-lgt)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >

        {/* Undo */}
        <TbBtn label="Undo" disabled={!canUndo} onClick={handleUndo}>
          <Undo2 size={16} />
        </TbBtn>
        {/* Redo */}
        <TbBtn label="Redo" disabled={!canRedo} onClick={handleRedo}>
          <Redo2 size={16} />
        </TbBtn>

        <div className="hidden sm:block">{SEP}</div>

        {/* Add-points toggle */}
        <TbBtn label="Add" active={addPointsEnabled} onClick={onToggleAddPoints}>
          <MapPinPlus size={16} />
        </TbBtn>

        {/* Snap toggle */}
        <TbBtn label="Snap" active={snapEnabled} disabled={!addPointsEnabled} onClick={onToggleSnap}>
          <Link2 size={16} />
        </TbBtn>

        {/* Clear */}
        <TbBtn label="Clear" disabled={waypoints.length === 0} onClick={handleClear}>
          <Trash2 size={16} />
        </TbBtn>

        {/* Desktop-only: Import + Export GPX */}
        <div className="hidden sm:flex items-center gap-2">
          {SEP}

          {/* Import */}
          <TbBtn label="Import" onClick={(e) => setImportAnchor((e.currentTarget as HTMLButtonElement).getBoundingClientRect())}>
            <Upload size={16} />
          </TbBtn>

          {/* Export GPX */}
          <TbBtn label="Export" disabled={!hasRoute} onClick={handleExportGpx}>
            <Download size={16} />
          </TbBtn>
        </div>

        {/* Reverse route */}
        <TbBtn label="Reverse" disabled={waypoints.length < 2} onClick={onReverse}>
          <ArrowRightLeft size={16} />
        </TbBtn>

        {/* Spacer — desktop only; hidden on mobile so flex-1 buttons distribute evenly */}
        <div className="hidden sm:block sm:flex-1" />

        {/* Desktop-only: route info / hint */}
        <div className="hidden sm:flex items-center">
          {routeInfo ? (
            <div style={{ font: '600 10px/1 var(--mono)', color: 'var(--fog)', letterSpacing: '.06em', padding: '0 12px', whiteSpace: 'nowrap' }}>
              {routeInfo}
            </div>
          ) : (
            <div style={{ font: '400 10px/1 var(--mono)', color: 'var(--fog-dim)', letterSpacing: '.04em', padding: '0 12px', whiteSpace: 'nowrap' }}>
              Click the map to place your first point
            </div>
          )}
          {SEP}
        </div>

        {/* Back (desktop only, when onBack provided) */}
        {onBack && (
          <div className="hidden sm:flex items-center">
            {SEP}
            <TbBtn label="Back" onClick={onBack}>
              <ChevronLeft size={16} />
            </TbBtn>
          </div>
        )}
      </div>

      {importAnchor && createPortal(
        <ImportRoutePopover
          anchorRect={importAnchor}
          onClose={() => setImportAnchor(null)}
          dispatch={dispatch}
          waypoints={waypoints}
          onFitToRoute={onFitToRoute}
          fileInputRef={fileInputRef}
          onImported={onImported}
        />,
        document.body,
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
