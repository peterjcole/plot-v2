'use client';

import { useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Undo2, Redo2, Trash2, Download, Upload, Mountain, LocateFixed, MapPinPlus, Magnet, Home } from 'lucide-react';
import { RouteAction } from './useRouteHistory';
import { downloadGpx, parseGpx, simplifyWaypoints } from '@/lib/gpx';
import { Waypoint, RouteSegment } from '@/lib/types';
import type { ElevationPoint } from './useElevationProfile';
import ElevationChart, { type ElevationHoverPoint } from './ElevationChart';
import Switch from '@/app/components/ui/Switch';
import IconToggle from '@/app/components/ui/IconToggle';

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
  onFitToRoute?: (waypoints: Waypoint[]) => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

const btnClass =
  'flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg text-text-primary hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors';


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
  onFitToRoute,
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const parsed = simplifyWaypoints(parseGpx(content));
      if (parsed.length >= 1) {
        const gpxSegments: RouteSegment[] = parsed.length > 1
          ? Array.from({ length: parsed.length - 1 }, () => ({ snapped: false, coordinates: [] }))
          : [];
        dispatch({ type: 'LOAD', waypoints: parsed, segments: gpxSegments });
        onFitToRoute?.(parsed);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [waypoints.length, dispatch, onFitToRoute]);

  return (
    <>
      <input type="file" accept=".gpx" className="hidden" ref={fileInputRef} onChange={handleImport} />
      {/* Toolbar + elevation column */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col max-w-[calc(100vw-1.5rem)]">
        {/* Main toolbar */}
        <div className={`relative flex items-center justify-evenly gap-1 bg-surface-raised/70 backdrop-blur-md shadow-lg border border-border px-2 py-1.5 sm:justify-start sm:gap-2 sm:px-3 sm:py-2 ${waypoints.length >= 2 ? 'rounded-t-xl' : 'rounded-xl'}`}>
          {/* Add Points toggle — icon on small, switch on large */}
          <div className="sm:hidden">
            <IconToggle pressed={addPointsEnabled} onPressedChange={() => onToggleAddPoints()} title="Add Points">
              <MapPinPlus size={18} />
            </IconToggle>
          </div>
          <div className="hidden sm:block">
            <Switch
              checked={addPointsEnabled}
              onCheckedChange={() => onToggleAddPoints()}
              label="Add Points"
            />
          </div>

          {/* Snap to Path — always visible as icon on small, slides in as switch on large */}
          <div className="sm:hidden">
            <IconToggle pressed={snapEnabled} onPressedChange={() => onToggleSnap()} title="Snap to Path" disabled={!addPointsEnabled}>
              <Magnet size={18} />
            </IconToggle>
          </div>
          <div
            className={`hidden sm:block overflow-hidden transition-all duration-200 ${
              addPointsEnabled
                ? 'max-w-48 opacity-100'
                : 'max-w-0 opacity-0'
            }`}
          >
            <Switch
              checked={snapEnabled}
              onCheckedChange={() => onToggleSnap()}
              label="Snap to Path"
            />
          </div>

          <div className="w-px h-6 bg-border shrink-0" />

          <button onClick={handleUndo} disabled={!canUndo} title="Undo" className={btnClass}>
            <Undo2 size={18} />
          </button>

          <button onClick={handleRedo} disabled={!canRedo} title="Redo" className={btnClass}>
            <Redo2 size={18} />
          </button>

          <div className="w-px h-6 bg-border shrink-0" />

          <button onClick={handleClear} disabled={waypoints.length === 0} title="Clear route" className={btnClass}>
            <Trash2 size={18} />
          </button>

          <button onClick={handleExport} disabled={waypoints.length === 0} title="Export GPX" className={btnClass}>
            <Download size={18} />
          </button>

          <button onClick={() => fileInputRef.current?.click()} title="Import GPX" className={btnClass}>
            <Upload size={18} />
          </button>

          {/* Home — mobile only, far right */}
          <div className="sm:hidden w-px h-6 bg-border shrink-0" />
          <Link href="/" title="Home" className={`${btnClass} sm:hidden`}>
            <Home size={18} />
          </Link>
        </div>

        {/* Elevation tray — slides down from under the toolbar */}
        <div
          className={`w-full overflow-hidden transition-all duration-300 ease-out ${
            waypoints.length >= 2
              ? 'max-h-[80px] opacity-100'
              : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="relative -mt-2 pt-4 flex items-center gap-3 bg-surface-raised/50 backdrop-blur-md rounded-b-xl shadow-md border border-border border-t-0 px-4 py-1.5">
            <span className="text-sm font-semibold text-text-primary tabular-nums shrink-0">
              {formatDistance(distance)}
            </span>
            <div className="relative flex items-center gap-2 flex-1 min-w-0 h-[28px]">
              {elevationGain != null && (
                <span className="inline-flex items-center gap-0.5 text-sm text-text-secondary tabular-nums shrink-0">
                  <Mountain size={10} strokeWidth={2.5} className="shrink-0" />
                  {elevationGain}m
                </span>
              )}
              {elevationData ? (
                <ElevationChart data={elevationData} onHover={onElevationHover} />
              ) : null}
              {isLoadingElevation && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Geolocation button — standalone, bottom-right */}
      <button
        onClick={onGeolocate}
        title="My location"
        className="absolute bottom-4 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-lg bg-surface-raised/70 backdrop-blur-md shadow-lg border border-border text-text-primary hover:bg-surface-muted transition-colors"
      >
        <LocateFixed size={18} />
      </button>
    </>
  );
}
