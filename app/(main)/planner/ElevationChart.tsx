'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ElevationPoint } from './useElevationProfile';

export interface ElevationHoverPoint {
  lat: number;
  lng: number;
  ele: number;
  distance: number;
}

interface ActivePoint extends ElevationHoverPoint {
  svgX: number; // in SVG viewBox coordinates (0–SVG_W)
  svgY: number;
  pillLeft: number; // clamped px left within the container div
}

interface ElevationChartProps {
  data: ElevationPoint[] | null;
  onHover?: (point: ElevationHoverPoint | null) => void;
  height?: number;
  isLoading?: boolean;
}

const SVG_W = 358;
const CHART_PAD_V = 10; // vertical breathing room so the line clears the min/max labels
const PILL_W = 52;
const PILL_PAD = 6;
const DRAG_THRESHOLD = 5;

function toSvgX(distance: number, totalD: number) {
  return totalD ? (distance / totalD) * SVG_W : 0;
}

function nearestPoint(
  data: ElevationPoint[],
  totalD: number,
  clientX: number,
  rect: DOMRect,
  minE: number,
  rangeE: number,
  H: number,
): ActivePoint {
  const relX = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const frac = relX / rect.width;
  const targetDist = frac * totalD;
  let lo = 0, hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].distance < targetDist) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(data[lo - 1].distance - targetDist) < Math.abs(data[lo].distance - targetDist)) lo--;
  const pt = data[lo];
  const svgX = toSvgX(pt.distance, totalD);
  const svgY = H - CHART_PAD_V - ((pt.ele - minE) / rangeE) * (H - CHART_PAD_V * 2);
  const pillLeft = Math.max(PILL_PAD, Math.min(relX - PILL_W / 2, rect.width - PILL_W - PILL_PAD));
  return { lat: pt.lat, lng: pt.lng, ele: pt.ele, distance: pt.distance, svgX, svgY, pillLeft };
}

export default function ElevationChart({ data, onHover, height = 64, isLoading = false }: ElevationChartProps) {
  const H = height;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<ActivePoint | null>(null);
  const [pinned, setPinned] = useState<ActivePoint | null>(null);
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
  const displayed = scrub ?? pinned;

  const onHoverRef = useRef(onHover);
  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);

  useEffect(() => {
    onHoverRef.current?.(displayed
      ? { lat: displayed.lat, lng: displayed.lng, ele: displayed.ele, distance: displayed.distance }
      : null);
  }, [displayed]);

  // Reset pinned when data changes (route updated)
  useEffect(() => { setPinned(null); }, [data]);

  const derived = useMemo(() => {
    if (!data || data.length < 2) return null;
    const eles = data.map(p => p.ele);
    const minE = Math.min(...eles);
    const maxE = Math.max(...eles);
    const rangeE = maxE - minE || 1;
    const totalD = data[data.length - 1].distance;
    const toX = (d: number) => toSvgX(d, totalD);
    const toY = (e: number) => H - CHART_PAD_V - ((e - minE) / rangeE) * (H - CHART_PAD_V * 2);
    const sparklinePts = data.map(p => `${toX(p.distance).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ');
    const fillPath = `M0,${H} L${sparklinePts.split(' ').join(' L')} L${SVG_W},${H} Z`;
    return { minE, maxE: Math.round(maxE), minELabel: Math.round(minE), rangeE, totalD, sparklinePts, fillPath };
  }, [data, H]);

  const getPoint = useCallback((clientX: number): ActivePoint | null => {
    if (!data || !derived || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return nearestPoint(data, derived.totalD, clientX, rect, derived.minE, derived.rangeE, H);
  }, [data, derived, H]);

  // ── Mouse handlers (desktop hover, no pin) ──────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setScrub(getPoint(e.clientX));
  }, [getPoint]);

  const handleMouseLeave = useCallback(() => {
    setScrub(null);
  }, []);

  // ── Touch handlers (mobile tap-pin / drag-scrub) ─────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    dragRef.current = { startX: touch.clientX, moved: false };
    setScrub(getPoint(touch.clientX));
  }, [getPoint]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (dragRef.current && Math.abs(touch.clientX - dragRef.current.startX) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }
    setScrub(getPoint(touch.clientX));
  }, [getPoint]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const drag = dragRef.current;
    dragRef.current = null;
    setScrub(null);
    if (drag && !drag.moved) {
      const tapped = scrub;
      setPinned(prev => {
        if (!tapped) return prev;
        if (prev && Math.abs(prev.svgX - tapped.svgX) < 8) return null;
        return tapped;
      });
    }
  }, [scrub]);

  const handleTouchCancel = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    dragRef.current = null;
    setScrub(null);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: H }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {/* Hover pill — two-line, clamped, above the chart */}
      {displayed && (
        <div style={{
          position: 'absolute',
          top: -32,
          left: displayed.pillLeft,
          fontSize: 9,
          fontFamily: 'var(--mono)',
          fontWeight: 700,
          color: 'var(--ice)',
          background: 'var(--p2)',
          border: '1px solid var(--p3)',
          borderRadius: 3,
          padding: '2px 5px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
          lineHeight: 1.4,
          textAlign: 'center',
          zIndex: 20,
        }}>
          <div>{(displayed.distance / 1000).toFixed(1)}&nbsp;km</div>
          <div style={{ color: 'var(--fog-dim)' }}>{Math.round(displayed.ele)}&nbsp;m</div>
        </div>
      )}

      {/* Loading placeholder */}
      {isLoading && !derived && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          fontSize: 8, color: 'var(--fog-ghost)', fontFamily: 'var(--mono)', letterSpacing: '0.06em',
        }}>
          Loading elevation…
        </div>
      )}

      <svg
        width="100%" height={H}
        viewBox={`0 0 ${SVG_W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="elev-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E07020" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#E07020" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {derived && (
          <>
            <path d={derived.fillPath} fill="url(#elev-chart-fill)" />
            <polyline
              points={derived.sparklinePts}
              fill="none" stroke="#E07020" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </>
        )}
        {displayed && (
          <line
            x1={displayed.svgX} x2={displayed.svgX} y1={0} y2={H}
            stroke="rgba(224,112,32,0.5)" strokeWidth={1} strokeDasharray="2 2"
          />
        )}
      </svg>

      {/* Crosshair dot — outside SVG so it stays circular under preserveAspectRatio="none" */}
      {displayed && (
        <div style={{
          position: 'absolute',
          left: `${(displayed.svgX / SVG_W) * 100}%`,
          top: displayed.svgY,
          transform: 'translate(-50%, -50%)',
          width: 7, height: 7,
          borderRadius: '50%',
          background: '#E07020',
          border: '1.5px solid rgba(7,14,20,0.8)',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
      )}

      {/* Min / max labels */}
      {derived && (
        <>
          <span style={{
            position: 'absolute', top: 0, left: 2,
            fontSize: 8, lineHeight: 1, color: 'var(--fog-dim)',
            fontFamily: 'var(--mono)', pointerEvents: 'none', letterSpacing: '0.04em',
          }}>
            {derived.maxE}m
          </span>
          <span style={{
            position: 'absolute', bottom: 0, left: 2,
            fontSize: 8, lineHeight: 1, color: 'var(--fog-dim)',
            fontFamily: 'var(--mono)', pointerEvents: 'none', letterSpacing: '0.04em',
          }}>
            {derived.minELabel}m
          </span>
        </>
      )}
    </div>
  );
}
