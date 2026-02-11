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

function resolveColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return value || fallback;
}

function colorWithAlpha(hex: string, alpha: number): string {
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
    let min = Infinity;
    let max = -Infinity;
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
      onHoverRef.current?.({
        lat: pt.lat,
        lng: pt.lng,
        ele: pt.ele,
        distance: pt.distance,
      });
    },
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const primary = resolveColor('--primary', '#4A5A2B');

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 50,
      layout: {
        background: { color: 'transparent' },
        textColor: 'transparent',
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false, minBarSpacing: 0 },
      crosshair: {
        mode: 1, // Magnet — snaps to data points
        vertLine: {
          color: colorWithAlpha(primary, 0.4),
          width: 1,
          visible: true,
          labelVisible: false,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: primary,
      topColor: colorWithAlpha(primary, 0.15),
      bottomColor: colorWithAlpha(primary, 0.02),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBackgroundColor: primary,
      crosshairMarkerBorderColor: '#ffffff',
      crosshairMarkerBorderWidth: 1,
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
    <div className="relative flex-1 min-w-[120px] max-w-[200px] h-[50px]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Min/max labels */}
      <span className="absolute top-0 right-1 text-[9px] leading-none text-text-secondary/70 pointer-events-none">
        {maxEle}m
      </span>
      <span className="absolute bottom-0 right-1 text-[9px] leading-none text-text-secondary/70 pointer-events-none">
        {minEle}m
      </span>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute top-[-18px] text-[10px] font-medium text-text-primary bg-surface-raised/90 rounded px-1 py-0.5 pointer-events-none whitespace-nowrap shadow-sm border border-border"
          style={{ left: tooltip.x, transform: 'translateX(-50%)' }}
        >
          {Math.round(tooltip.ele)}m
        </div>
      )}
    </div>
  );
}
