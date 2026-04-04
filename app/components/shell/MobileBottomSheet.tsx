'use client';

import { useEffect, useState } from 'react';

const COLLAPSED_HEIGHT = 130;
const EXPANDED_HEIGHT_VH = 72;

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
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand when parent forces it (e.g. detail mode)
  useEffect(() => {
    if (forceExpanded) setIsExpanded(true);
  }, [forceExpanded]);

  const sheetHeight = isExpanded ? `${EXPANDED_HEIGHT_VH}vh` : `${COLLAPSED_HEIGHT}px`;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: sheetHeight,
      background: 'var(--p1)',
      borderRadius: '16px 16px 0 0',
      borderTop: '1px solid var(--p3)',
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'height 0.3s ease',
    }}>
      {/* Handle */}
      <div
        onClick={() => setIsExpanded((v) => !v)}
        style={{ padding: '10px 0 6px', cursor: 'pointer', flexShrink: 0 }}
        role="button"
        aria-label={isExpanded ? 'Collapse sheet' : 'Expand sheet'}
      >
        <div style={{
          width: 36, height: 4,
          background: 'var(--p4)', borderRadius: 2,
          margin: '0 auto',
        }} />
      </div>

      {/* Sheet header (always visible) */}
      <div
        onClick={() => !isExpanded && setIsExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 16px 8px',
          flexShrink: 0,
          cursor: isExpanded ? 'default' : 'pointer',
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
          onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
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

      {/* Scrollable content — only visible when expanded */}
      <div style={{
        flex: 1,
        overflow: isExpanded ? 'auto' : 'hidden',
        opacity: isExpanded ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}>
        {children}
      </div>
    </div>
  );
}
