'use client';

import { useState, useEffect } from 'react';
import { type MapLayer } from '@/app/components/MainMap';

export interface LayerState {
  baseLayer: MapLayer;
  showHillshade: boolean;
  showPhotos: boolean;
  dimBaseMap: boolean;
  showPersonalHeatmap: boolean;
  showPOIs: boolean;
  showGlobalHeatmap: boolean;
}

export const DEFAULT_LAYER_STATE: LayerState = {
  baseLayer: 'topo',
  showHillshade: false,
  showPhotos: true,
  dimBaseMap: false,
  showPersonalHeatmap: false,
  showPOIs: false,
  showGlobalHeatmap: false,
};

interface LayersPanelProps {
  state: LayerState;
  onChange: (patch: Partial<LayerState>) => void;
  bottom?: number;
  fixed?: boolean;
  forceOpen?: boolean;
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: 28, height: 16, borderRadius: 8,
        background: on ? 'var(--ora)' : 'var(--p3)',
        position: 'relative', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: on ? 14 : 2,
        width: 12, height: 12, borderRadius: '50%',
        background: 'var(--ice)',
        transition: 'left 0.15s',
        display: 'block',
      }} />
    </button>
  );
}

function Row({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', gap: 8 }}>
      <span style={{ flex: 1, font: '400 10px/1 var(--mono)', color: disabled ? 'var(--fog-dim)' : 'var(--fog)', letterSpacing: '0.03em' }}>
        {label}
      </span>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--fog-ghost)', margin: '8px 0' }} />;
}

export default function LayersPanel({ state, onChange, bottom = 16, fixed = false, forceOpen }: LayersPanelProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (forceOpen !== undefined) setOpen(forceOpen); }, [forceOpen]);

  return (
    <div style={{
      position: fixed ? 'fixed' : 'absolute',
      bottom, left: 12,
      zIndex: 15,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 8,
    }}>
      {/* Panel card */}
      {open && (
        <div style={{
          width: 224,
          background: 'var(--glass-hvy)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid var(--p3)',
          borderRadius: 8,
          padding: '12px 12px 8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ font: '600 10px/1 var(--mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fog)' }}>
              Layers
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ color: 'var(--fog-dim)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
              aria-label="Close layers"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Base map */}
          <div style={{ font: '500 8px/1 var(--mono)', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--fog-dim)', marginBottom: 6 }}>
            Base map
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(['topo', 'satellite'] as MapLayer[]).map((l) => {
              const active = state.baseLayer === l;
              return (
                <button
                  key={l}
                  onClick={() => onChange({ baseLayer: l })}
                  style={{
                    flex: 1, height: 26, borderRadius: 3,
                    background: active ? 'rgba(224,112,32,0.15)' : 'transparent',
                    border: `1px solid ${active ? 'var(--ora)' : 'var(--p3)'}`,
                    font: '600 9px/1 var(--mono)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: active ? 'var(--ora)' : 'var(--fog-dim)',
                    cursor: 'pointer',
                  }}
                >
                  {l === 'topo' ? 'OS / Topo' : 'Satellite'}
                </button>
              );
            })}
          </div>

          {/* Hillshading */}
          <Row label="Hillshading" on={state.showHillshade} onChange={(v) => onChange({ showHillshade: v })} />

          <Divider />

          {/* Personal */}
          <Row label="My photos" on={state.showPhotos} onChange={(v) => onChange({ showPhotos: v })} />
          <Row label="Personal heatmap" on={state.showPersonalHeatmap} onChange={(v) => onChange({ showPersonalHeatmap: v })} disabled />
          <Row label="Explorer tiles" on={false} onChange={() => {}} disabled />

          <Divider />

          {/* POIs */}
          <Row label="Points of interest" on={state.showPOIs} onChange={(v) => onChange({ showPOIs: v })} disabled />

          <Divider />

          {/* Global heatmap */}
          <Row label="Global heatmap" on={state.showGlobalHeatmap} onChange={(v) => onChange({ showGlobalHeatmap: v })} disabled />

          <Divider />

          {/* Dim base map */}
          <Row label="Dim base map" on={state.dimBaseMap} onChange={(v) => onChange({ dimBaseMap: v })} />
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle layers panel"
        aria-expanded={open}
        style={{
          width: 44, height: 44, borderRadius: 8,
          background: 'var(--glass)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: `1px solid ${open ? 'var(--ora)' : 'var(--p3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: open ? 'var(--ora)' : 'var(--fog-dim)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
      </button>
    </div>
  );
}
