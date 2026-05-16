'use client';

import { useEffect, useRef, useState } from 'react';

const PEEK = 170;

interface MobileBottomSheetProps {
  title?: string;
  count?: number;
  defaultSnap?: 'peek' | 'mid' | 'expanded';
  hideHeader?: boolean;
  showSearch?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function MobileBottomSheet({
  title = 'Activities',
  count,
  defaultSnap = 'peek',
  hideHeader,
  showSearch = true,
  style: styleProp,
  children,
}: MobileBottomSheetProps) {
  const [snapMid, setSnapMid] = useState(420);
  const [snapExpanded, setSnapExpanded] = useState(520);
  const [height, setHeight] = useState(PEEK);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const update = () => {
      setSnapMid(Math.round(window.innerHeight * 0.5));
      setSnapExpanded(Math.round(window.innerHeight * 0.72));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Sync to defaultSnap when the mode prop changes (intentionally excludes snapMid/snapExpanded)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- snapMid/snapExpanded intentionally excluded; only fire on mode change
  useEffect(() => {
    setHeight(defaultSnap === 'expanded' ? snapExpanded : defaultSnap === 'mid' ? snapMid : PEEK);
  }, [defaultSnap]);

  const isExpanded = height > PEEK + 20;

  function handleTouchStart(e: React.TouchEvent) {
    dragRef.current = { startY: e.touches[0].clientY, startHeight: height };
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.touches[0].clientY;
    const next = Math.max(PEEK, Math.min(window.innerHeight * 0.9, dragRef.current.startHeight + delta));
    setHeight(next);
  }

  function handleTouchEnd() {
    if (!dragRef.current) return;
    setIsDragging(false);
    const snaps = [PEEK, snapMid, snapExpanded];
    const nearest = snaps.reduce((a, b) => Math.abs(a - height) < Math.abs(b - height) ? a : b);
    setHeight(nearest);
    dragRef.current = null;
  }

  function toggleExpand() {
    setHeight(h => {
      if (h <= PEEK + 20) return snapMid;
      if (h <= snapMid + 20) return snapExpanded;
      return PEEK;
    });
  }

  const { transition: extraTransition, ...restStyleProp } = styleProp ?? {};
  const transition = isDragging
    ? 'none'
    : ['height 0.3s ease', extraTransition].filter(Boolean).join(', ');

  return (
    <div style={{
      position: 'fixed',
      bottom: 10, left: 10, right: 10,
      height,
      background: 'var(--p1)',
      borderRadius: 16,
      border: '1px solid var(--p3)',
      boxShadow: '0 -4px 24px rgba(0,0,0,.35)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      touchAction: 'none',
      ...restStyleProp,
      transition,
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
          width: 48, height: 6,
          background: 'var(--p3)', borderRadius: 3,
          margin: '0 auto',
        }} />
      </div>

      {/* Sheet header — hidden in detail mode since capsule shows back/title/chip */}
      {!hideHeader && (
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
          {showSearch && (
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
          )}
        </div>
      )}

      {/* Scrollable content — gradient is absolute so it doesn't push content */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          overflowY: isExpanded ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
        }}>
          {children}
        </div>
        {isExpanded && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 48,
              background: 'linear-gradient(to bottom, transparent, var(--p1))',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}
