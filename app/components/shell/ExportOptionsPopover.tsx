'use client';

import { useEffect, useRef, useState } from 'react';

interface ExportOptionsPopoverProps {
  activityId: string;
  osDark: boolean;
  anchorRect: { x: number; y: number };
  onClose: () => void;
}

function Toggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--fog)', fontFamily: 'var(--mono)' }}>{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
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

function SegLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 6, marginTop: 12 }}>
      {children}
    </div>
  );
}

export default function ExportOptionsPopover({ activityId, osDark, anchorRect, onClose }: ExportOptionsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const [includeImages, setIncludeImages] = useState(true);
  const [baseMap, setBaseMap] = useState<'os' | 'satellite'>('os');
  const [darkMode, setDarkMode] = useState(osDark);
  const [hillshade, setHillshade] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(true);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    popoverRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      (returnFocusRef.current as HTMLElement)?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    const handleMousedown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, [onClose]);

  function buildUrl() {
    const photoCount = includeImages ? 3 : 0;
    const params = new URLSearchParams({
      activityId,
      format: 'jpeg',
      photoCount: String(photoCount),
      baseMap,
    });
    if (darkMode) params.set('osDark', 'true');
    if (hillshade) params.set('hillshadeEnabled', 'true');
    if (showDescription) params.set('hideDescription', 'false');
    if (includeLogo) params.set('includeLogo', 'true');
    return `/api/activity-printout?${params.toString()}`;
  }

  function handleDownload() {
    window.open(buildUrl(), '_blank', 'noopener');
    onClose();
  }

  // Position: appear just below and to the left of the anchor
  const left = Math.max(8, anchorRect.x - 200);
  const top = anchorRect.y + 8;

  return (
    <div
      ref={popoverRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Export options"
      style={{
        position: 'fixed',
        top,
        left,
        width: 240,
        background: 'var(--glass-hvy)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--p3)',
        borderRadius: 8,
        padding: 14,
        zIndex: 9999,
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        outline: 'none',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ice)', fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Export options
        </span>
        <button
          onClick={onClose}
          aria-label="Close export options"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fog-dim)', padding: 0, lineHeight: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Base map */}
      <SegLabel>Base map</SegLabel>
      <div style={{ display: 'flex', gap: 4 }}>
        {(['os', 'satellite'] as const).map((bm) => (
          <button
            key={bm}
            onClick={() => setBaseMap(bm)}
            style={{
              flex: 1, padding: '5px 0',
              background: baseMap === bm ? 'var(--ora)' : 'var(--p3)',
              border: 'none', borderRadius: 4,
              color: baseMap === bm ? 'var(--p0)' : 'var(--fog)',
              fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {bm === 'os' ? 'OS / Topo' : 'Satellite'}
          </button>
        ))}
      </div>

      {/* OS options */}
      {baseMap === 'os' && (
        <div style={{ marginTop: 10, paddingLeft: 8, borderLeft: '2px solid var(--p3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle label="Dark mode" checked={darkMode} onToggle={() => setDarkMode(v => !v)} />
          <Toggle label="Hillshading" checked={hillshade} onToggle={() => setHillshade(v => !v)} />
        </div>
      )}

      {/* Options */}
      <SegLabel>Options</SegLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Toggle label="Include images" checked={includeImages} onToggle={() => setIncludeImages(v => !v)} />
        <Toggle label="Include description" checked={showDescription} onToggle={() => setShowDescription(v => !v)} />
        <Toggle label="Include logo" checked={includeLogo} onToggle={() => setIncludeLogo(v => !v)} />
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--fog-ghost)', margin: '12px 0' }} />

      {/* Download button */}
      <button
        onClick={handleDownload}
        style={{
          width: '100%', padding: '9px 12px',
          background: 'var(--ora)', border: 'none', borderRadius: 4,
          color: 'var(--p0)', fontFamily: 'var(--mono)', fontSize: 11,
          fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download JPEG
      </button>
    </div>
  );
}
