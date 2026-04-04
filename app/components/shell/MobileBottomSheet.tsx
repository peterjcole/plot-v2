'use client';

import { useEffect, useRef, useState } from 'react';

const COLLAPSED = 130;

interface MobileBottomSheetProps {
  title?: string;
  count?: number;
  forceExpanded?: boolean;
  children: React.ReactNode;
}

export default function MobileBottomSheet({
  title = 'Activities',
  count,
  forceExpanded,
  children,
}: MobileBottomSheetProps) {
  const [snapExpanded, setSnapExpanded] = useState(520);
  const [height, setHeight] = useState(COLLAPSED);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Compute expanded snap point after mount (depends on window height)
  useEffect(() => {
    setSnapExpanded(Math.round(window.innerHeight * 0.72));
  }, []);

  // Auto-snap to expanded when parent forces it
  useEffect(() => {
    if (forceExpanded) setHeight((h) => Math.max(h, snapExpanded));
  }, [forceExpanded, snapExpanded]);

  const isExpanded = height > COLLAPSED + 20;

  function handleTouchStart(e: React.TouchEvent) {
    dragRef.current = { startY: e.touches[0].clientY, startHeight: height };
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.touches[0].clientY;
    const next = Math.max(COLLAPSED, Math.min(window.innerHeight * 0.9, dragRef.current.startHeight + delta));
    setHeight(next);
  }

  function handleTouchEnd() {
    if (!dragRef.current) return;
    setIsDragging(false);
    const mid = (COLLAPSED + snapExpanded) / 2;
    setHeight(height >= mid ? snapExpanded : COLLAPSED);
    dragRef.current = null;
  }

  function toggleExpand() {
    setHeight((h) => (h > COLLAPSED + 20 ? COLLAPSED : snapExpanded));
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height,
      background: 'var(--p1)',
      borderRadius: '16px 16px 0 0',
      borderTop: '1px solid var(--p3)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: isDragging ? 'none' : 'height 0.3s ease',
      touchAction: 'none',
    }}>
      {/* Draggable handle */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={toggleExpand}
        style={{ padding: '10px 0 6px', cursor: 'grab', flexShrink: 0, userSelect: 'none' }}
        role="button"
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
      >
        <div style={{
          width: 36, height: 4,
          background: 'var(--p4)', borderRadius: 2,
          margin: '0 auto',
        }} />
      </div>

      {/* Sheet header (always visible) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => !isExpanded && toggleExpand()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 16px 8px',
          flexShrink: 0,
          cursor: isExpanded ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ice)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', flex: 1 }}>
          {title}
        </span>
        {count !== undefined && (
          <span style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
            {count} total
          </span>
        )}
        <button
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (!isExpanded) toggleExpand(); }}
          style={{
            width: 28, height: 28, borderRadius: 4,
            border: '1px solid var(--p3)', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fog-dim)', cursor: 'pointer',
          }}
          aria-label="Search"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: isExpanded ? 'auto' : 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}
