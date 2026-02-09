'use client';

import { useCallback } from 'react';
import { RouteAction } from './useRouteHistory';
import { downloadGpx } from '@/lib/gpx';
import { Waypoint } from '@/lib/types';

interface PlannerToolbarProps {
  waypoints: Waypoint[];
  distance: number;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: React.Dispatch<RouteAction>;
  onGeolocate: () => void;
  addPointsEnabled: boolean;
  onToggleAddPoints: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

const btnClass =
  'flex items-center justify-center w-11 h-11 rounded-lg text-text-primary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

export default function PlannerToolbar({
  waypoints,
  distance,
  canUndo,
  canRedo,
  dispatch,
  onGeolocate,
  addPointsEnabled,
  onToggleAddPoints,
}: PlannerToolbarProps) {
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
    downloadGpx(waypoints);
  }, [waypoints]);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-surface-raised/95 backdrop-blur-sm rounded-xl shadow-lg border border-border px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
      {/* Add-points toggle */}
      <button
        onClick={onToggleAddPoints}
        title={addPointsEnabled ? 'Disable add mode' : 'Enable add mode'}
        className={`flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${
          addPointsEnabled
            ? 'bg-accent-light/20 text-accent'
            : 'text-text-primary hover:bg-surface-muted'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </button>

      {/* Distance display — hidden on very small screens */}
      <div className="hidden sm:block text-text-primary font-medium text-sm whitespace-nowrap px-2">
        {distance > 0
          ? formatDistance(distance)
          : addPointsEnabled
            ? 'Click map to start'
            : 'Click + to start'}
      </div>
      {/* Compact distance for mobile */}
      <div className="sm:hidden text-text-primary font-medium text-xs whitespace-nowrap px-1">
        {distance > 0 ? formatDistance(distance) : ''}
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

      <div className="w-px h-6 bg-border" />

      <button onClick={onGeolocate} title="My location" className={btnClass}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </svg>
      </button>
    </div>
  );
}
