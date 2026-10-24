'use client';

import { useEffect, useRef } from 'react';
import { Link2, X, Check } from 'lucide-react';

interface RotateRoutePanelProps {
  draftDist: number;
  loopLength: number;
  /** Route already ends at its start — no closing leg will be added. */
  closed: boolean;
  closeSnap: boolean;
  canApply: boolean;
  onChange: (dist: number) => void;
  onToggleCloseSnap: () => void;
  onApply: () => void;
  onCancel: () => void;
}

const SLIDER_STEP = 10; // metres

function fmtKm(m: number): string {
  return (m / 1000).toFixed(m < 10000 ? 2 : 1);
}

const btnStyle: React.CSSProperties = {
  height: 32, padding: '0 12px', borderRadius: 4, border: 'none',
  font: '700 10px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0,
};

/**
 * Controls for rotate-route mode — sits just under the planner toolbar on both desktop
 * (absolute, inside the map area) and mobile (fixed, under the floating toolbar, clear of
 * the bottom HUD sheet). The map handle and this slider drive the same draft position.
 */
export default function RotateRoutePanel({
  draftDist,
  loopLength,
  closed,
  closeSnap,
  canApply,
  onChange,
  onToggleCloseSnap,
  onApply,
  onCancel,
}: RotateRoutePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Enter applies / Esc cancels — unless the user is typing somewhere (e.g. place search).
  // Enter on a focused button is left to that button (Cancel, the closing-leg toggle).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only when nothing else has focus (the map) or focus is in this panel — not while
      // another popover or input is being used.
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const inPanel = !!t && !!panelRef.current?.contains(t);
      if (!inPanel && t !== document.body) return;
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter' && canApply && t?.tagName !== 'BUTTON') { e.preventDefault(); onApply(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onApply, onCancel, canApply]);

  return (
    <div
      ref={panelRef}
      className="animate-panel-in fixed sm:absolute top-[122px] sm:top-[60px] left-[10px] right-[10px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[420px] rounded-[10px] border border-p3 z-20 sm:z-[5]"
      style={{ background: 'var(--glass-lgt)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '12px 14px' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ font: '600 9px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fog-dim)' }}>
          Start / finish
        </div>
        <div style={{ font: '600 11px/1 var(--mono)', color: 'var(--fog)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--ora)' }}>{fmtKm(draftDist)}</span> / {fmtKm(loopLength)} km
        </div>
      </div>

      <input
        type="range"
        className="rotate-range"
        aria-label="Start position along the route"
        autoFocus
        min={0}
        max={Math.max(SLIDER_STEP, Math.round(loopLength))}
        step={SLIDER_STEP}
        value={Math.round(draftDist)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', margin: '12px 0' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {closed ? (
          <div style={{ font: '400 10px/1.3 var(--mono)', color: 'var(--fog-dim)', flex: 1 }}>
            Route is already a loop
          </div>
        ) : (
          <button
            onClick={onToggleCloseSnap}
            title={closeSnap ? 'Closing leg follows paths' : 'Closing leg is a straight line'}
            style={{ ...btnStyle, flex: 1, justifyContent: 'flex-start', padding: 0, background: 'transparent', color: closeSnap ? 'var(--ora)' : 'var(--fog)', cursor: 'pointer' }}
          >
            <Link2 size={14} />
            Closing leg: {closeSnap ? 'snap' : 'straight'}
          </button>
        )}
        <button onClick={onCancel} style={{ ...btnStyle, background: 'var(--p3)', color: 'var(--fog)', cursor: 'pointer' }}>
          <X size={14} />
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={!canApply}
          style={{ ...btnStyle, background: canApply ? 'var(--ora)' : 'var(--p3)', color: canApply ? 'var(--p0)' : 'var(--fog-dim)', cursor: canApply ? 'pointer' : 'not-allowed' }}
        >
          <Check size={14} />
          Apply
        </button>
      </div>

      <style>{`
        .rotate-range { -webkit-appearance: none; appearance: none; height: 24px; background: transparent; cursor: pointer; }
        .rotate-range::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--p3); }
        .rotate-range::-moz-range-track { height: 4px; border-radius: 2px; background: var(--p3); }
        .rotate-range::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; margin-top: -9px; border-radius: 50%; background: var(--ora); border: 3px solid rgba(7,14,20,0.85); }
        .rotate-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--ora); border: 3px solid rgba(7,14,20,0.85); }
        .rotate-range:focus-visible { outline: 1px solid var(--ora); outline-offset: 2px; }
      `}</style>
    </div>
  );
}
