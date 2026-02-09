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
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export default function PlannerToolbar({
  waypoints,
  distance,
  canUndo,
  canRedo,
  dispatch,
  onGeolocate,
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
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-surface-raised/95 backdrop-blur-sm rounded-xl shadow-lg border border-border px-3 py-2">
      {/* Distance display */}
      <div className="text-text-primary font-medium text-sm whitespace-nowrap px-2">
        {distance > 0 ? formatDistance(distance) : 'Click map to start'}
      </div>

      <div className="w-px h-6 bg-border" />

      {/* Undo */}
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        title="Undo"
        className="flex items-center justify-center w-11 h-11 rounded-lg text-text-primary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>

      {/* Redo */}
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        title="Redo"
        className="flex items-center justify-center w-11 h-11 rounded-lg text-text-primary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
        </svg>
      </button>

      <div className="w-px h-6 bg-border" />

      {/* Clear */}
      <button
        onClick={handleClear}
        disabled={waypoints.length === 0}
        title="Clear route"
        className="flex items-center justify-center w-11 h-11 rounded-lg text-text-primary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>

      {/* Export GPX */}
      <button
        onClick={handleExport}
        disabled={waypoints.length === 0}
        title="Export GPX"
        className="flex items-center justify-center w-11 h-11 rounded-lg text-text-primary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      <div className="w-px h-6 bg-border" />

      {/* Geolocation */}
      <button
        onClick={onGeolocate}
        title="My location"
        className="flex items-center justify-center w-11 h-11 rounded-lg text-text-primary hover:bg-surface-muted transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </svg>
      </button>
    </div>
  );
}
