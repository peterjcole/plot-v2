'use client';

import { useEffect, useRef } from 'react';
import { Waypoint, RouteSegment } from '@/lib/types';

interface WaypointPopoverProps {
  waypoint: Waypoint;
  index: number;
  totalWaypoints: number;
  segments: RouteSegment[];
  screenX: number;
  screenY: number;
  onClose: () => void;
  onDelete: (index: number) => void;
  onToggleSnapIn: (index: number) => void;
  onToggleSnapOut: (index: number) => void;
}

export default function WaypointPopover({
  waypoint, index, totalWaypoints, segments,
  screenX, screenY,
  onClose, onDelete, onToggleSnapIn, onToggleSnapOut,
}: WaypointPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    popoverRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      (returnFocusRef.current as HTMLElement)?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    const handleMousedown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, [onClose]);

  const snapInEnabled = index > 0 ? (segments[index - 1]?.snapped ?? false) : false;
  const snapOutEnabled = index < totalWaypoints - 1 ? (segments[index]?.snapped ?? false) : false;

  const lat = waypoint.lat.toFixed(4);
  const lngAbs = Math.abs(waypoint.lng).toFixed(4);
  const lngDir = waypoint.lng < 0 ? 'W' : 'E';

  function SnapToggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 9, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>
          Snap to path {label}
        </span>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={`Snap to path ${label}`}
          onClick={onToggle}
          style={{
            width: 28, height: 16, borderRadius: 8, border: 'none', padding: 0,
            background: checked ? 'var(--ora)' : 'var(--p3)',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            width: 12, height: 12, borderRadius: '50%', background: 'var(--ice)',
            position: 'absolute', top: 2,
            left: checked ? 14 : 2,
            transition: 'left 0.15s',
          }} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={popoverRef}
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: screenX,
        top: screenY,
        transform: 'translateX(-50%) translateY(calc(-100% - 12px))',
        width: 200,
        background: 'var(--p1)',
        border: '1px solid var(--p3)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        padding: 10,
        zIndex: 40,
        outline: 'none',
      }}
    >
      {/* Name + coords */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ice)', fontFamily: 'var(--mono)', lineHeight: 1.3 }}>
          {waypoint.name ?? `Waypoint ${index + 1}`}
        </div>
        <div style={{ fontSize: 9, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
          {lat}°N, {lngAbs}°{lngDir}
        </div>
      </div>

      {/* Snap toggles */}
      {(index > 0 || index < totalWaypoints - 1) && (
        <>
          <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 8 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {index > 0 && (
              <SnapToggle
                label="In"
                checked={snapInEnabled}
                onToggle={() => onToggleSnapIn(index)}
              />
            )}
            {index < totalWaypoints - 1 && (
              <SnapToggle
                label="Out"
                checked={snapOutEnabled}
                onToggle={() => onToggleSnapOut(index)}
              />
            )}
          </div>
        </>
      )}

      {/* Delete */}
      <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 8 }} />
      <button
        onClick={() => {
          if (window.confirm(`Remove waypoint ${index + 1}?`)) {
            onDelete(index);
            onClose();
          }
        }}
        aria-label={`Delete waypoint ${index + 1}`}
        style={{
          width: '100%', padding: '6px 8px',
          background: 'var(--p2)', border: '1px solid var(--fog-ghost)', borderRadius: 4,
          color: 'var(--ora)', fontFamily: 'var(--mono)', fontSize: 10,
          fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
        }}
      >
        Delete waypoint
      </button>
    </div>
  );
}
