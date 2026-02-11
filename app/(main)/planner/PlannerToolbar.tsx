'use client';

import { useCallback, useMemo } from 'react';
import { RouteAction } from './useRouteHistory';
import { downloadGpx } from '@/lib/gpx';
import { Waypoint, RouteSegment } from '@/lib/types';
import type { ElevationPoint } from './useElevationProfile';
import ElevationChart, { type ElevationHoverPoint } from './ElevationChart';

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
  onElevationHover?: (point: ElevationHoverPoint | null) => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

const btnClass =
  'flex items-center justify-center w-11 h-11 rounded-lg text-text-primary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

function ToggleSwitch({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-surface-muted sm:gap-2"
    >
      <div
        className={`relative w-8 h-[18px] rounded-full transition-colors ${
          enabled ? 'bg-accent' : 'bg-text-secondary/30'
        }`}
      >
        <div
          className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform ${
            enabled ? 'translate-x-[15px]' : 'translate-x-[2px]'
          }`}
        />
      </div>
      <span className="text-xs font-medium text-text-primary leading-tight">
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
  addPointsEnabled,
  onToggleAddPoints,
  snapEnabled,
  onToggleSnap,
  elevationData,
  isLoadingElevation,
  onElevationHover,
}: PlannerToolbarProps) {
  const elevationGain = useMemo(() => {
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
    if (window.confirm('Clear the entire route?')) {
      dispatch({ type: 'CLEAR' });
    }
  }, [waypoints.length, dispatch]);

  const handleExport = useCallback(() => {
    if (waypoints.length === 0) return;
    downloadGpx(waypoints, segments);
  }, [waypoints, segments]);

  return (
    <>
      {/* Main toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-surface-raised/95 backdrop-blur-sm rounded-xl shadow-lg border border-border px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
        {/* Add Points toggle */}
        <ToggleSwitch
          enabled={addPointsEnabled}
          onToggle={onToggleAddPoints}
          label="Add Points"
        />

        {/* Snap to Path toggle — slides in when Add Points is ON */}
        <div
          className={`overflow-hidden transition-all duration-200 ${
            addPointsEnabled
              ? 'max-w-48 opacity-100'
              : 'max-w-0 opacity-0'
          }`}
        >
          <ToggleSwitch
            enabled={snapEnabled}
            onToggle={onToggleSnap}
            label="Snap to Path"
          />
        </div>

        <div className="w-px h-6 bg-border" />

        <button onClick={handleUndo} disabled={!canUndo} title="Undo" className={btnClass}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>

        <button onClick={handleRedo} disabled={!canRedo} title="Redo" className={btnClass}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
        </button>

        <div className="w-px h-6 bg-border" />

        <button onClick={handleClear} disabled={waypoints.length === 0} title="Clear route" className={btnClass}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>

        <button onClick={handleExport} disabled={waypoints.length === 0} title="Export GPX" className={btnClass}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>

      {/* Distance tray — visible when route has 2+ waypoints */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-10 w-max transition-all duration-300 ease-out ${
          waypoints.length >= 2
            ? 'top-[68px] sm:top-[72px] opacity-100'
            : 'top-[52px] sm:top-[56px] opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative flex items-center gap-3 bg-surface-raised/80 backdrop-blur-sm rounded-lg shadow-md border border-border px-4 py-1.5">
          <span className="text-sm font-semibold text-text-primary tabular-nums shrink-0">
            {formatDistance(distance)}
          </span>
          {(elevationGain != null || elevationData || isLoadingElevation) && (
            <div className="relative flex items-center gap-2">
              {elevationGain != null && (
                <span className="inline-flex items-center gap-0.5 text-sm text-text-secondary tabular-nums shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
                  </svg>
                  {elevationGain}m
                </span>
              )}
              {elevationData ? (
                <ElevationChart data={elevationData} onHover={onElevationHover} />
              ) : isLoadingElevation ? (
                <div className="min-w-[120px] max-w-[200px] h-[50px]" />
              ) : null}
              {isLoadingElevation && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-raised/80 backdrop-blur-sm rounded-lg">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Geolocation button — standalone, bottom-right */}
      <button
        onClick={onGeolocate}
        title="My location"
        className="absolute bottom-4 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-lg bg-surface-raised/95 backdrop-blur-sm shadow-lg border border-border text-text-primary hover:bg-surface-muted transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </svg>
      </button>
    </>
  );
}
