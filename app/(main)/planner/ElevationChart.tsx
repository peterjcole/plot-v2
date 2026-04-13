'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { createChart, AreaSeries, type IChartApi } from 'lightweight-charts';
import type { ElevationPoint } from './useElevationProfile';

export interface ElevationHoverPoint {
  lat: number;
  lng: number;
  ele: number;
  distance: number;
}

interface ElevationChartProps {
  data: ElevationPoint[] | null;
  onHover?: (point: ElevationHoverPoint | null) => void;
}

function resolveVar(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function ElevationChart({ data, onHover }: ElevationChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;

  const [tooltip, setTooltip] = useState<{ x: number; ele: number } | null>(null);

  const { minEle, maxEle } = useMemo(() => {
    if (!data || data.length < 2) return { minEle: 0, maxEle: 0 };
    let min = Infinity, max = -Infinity;
    for (const pt of data) {
      if (pt.ele < min) min = pt.ele;
      if (pt.ele > max) max = pt.ele;
    }
    return { minEle: Math.round(min), maxEle: Math.round(max) };
  }, [data]);

  const dataRef = useRef(data);
  dataRef.current = data;

  const handleCrosshairMove = useCallback(
    (param: { time?: unknown; point?: { x: number; y: number } }) => {
      const d = dataRef.current;
      if (!param.time || !d) {
        setTooltip(null);
        onHoverRef.current?.(null);
        return;
      }
      const index = param.time as number;
      const pt = d[index];
      if (!pt) {
        setTooltip(null);
        onHoverRef.current?.(null);
        return;
      }
      setTooltip({ x: param.point?.x ?? 0, ele: pt.ele });
      onHoverRef.current?.({ lat: pt.lat, lng: pt.lng, ele: pt.ele, distance: pt.distance });
    },
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const accent = resolveVar('--ora', '#E07020');
    const fogDim = resolveVar('--fog-dim', '#5A7A8A');

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 64,
      layout: {
        background: { color: 'transparent' },
        textColor: fogDim,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false, minBarSpacing: 0 },
      crosshair: {
        mode: 1, // Magnet — snaps to nearest data point
        vertLine: {
          color: hexToRgba(accent, 0.5),
          width: 1,
          visible: true,
          labelVisible: false,
        },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: accent,
      topColor: hexToRgba(accent, 0.18),
      bottomColor: hexToRgba(accent, 0.02),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBackgroundColor: accent,
      crosshairMarkerBorderColor: resolveVar('--p0', '#070E14'),
      crosshairMarkerBorderWidth: 1.5,
    });

    chartRef.current = chart;

    if (data && data.length >= 2) {
      const seriesData = data.map((pt, i) => ({
        time: i as unknown as import('lightweight-charts').UTCTimestamp,
        value: pt.ele,
      }));
      series.setData(seriesData);
      chart.timeScale().fitContent();
    }

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      setTooltip(null);
      onHoverRef.current?.(null);
    };
  }, [data, handleCrosshairMove]);

  if (!data || data.length < 2) return null;

  return (
    <div style={{ position: 'relative', width: '100%', height: 64 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Min/max elevation labels */}
      <span style={{
        position: 'absolute', top: 0, right: 2,
        fontSize: 8, lineHeight: 1, color: 'var(--fog-dim)',
        fontFamily: 'var(--mono)', pointerEvents: 'none',
        letterSpacing: '0.04em',
      }}>
        {maxEle}m
      </span>
      <span style={{
        position: 'absolute', bottom: 0, right: 2,
        fontSize: 8, lineHeight: 1, color: 'var(--fog-dim)',
        fontFamily: 'var(--mono)', pointerEvents: 'none',
        letterSpacing: '0.04em',
      }}>
        {minEle}m
      </span>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          top: -20,
          left: tooltip.x,
          transform: 'translateX(-50%)',
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
        }}>
          {Math.round(tooltip.ele)}m
        </div>
      )}
    </div>
  );
}
