'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { selectGpxWaypoints } from '@/lib/gpx';
import { Waypoint, RouteSegment } from '@/lib/types';
import { RouteAction } from '@/app/(main)/planner/useRouteHistory';

interface ImportRoutePopoverProps {
  anchorRect: DOMRect;
  onClose: () => void;
  dispatch: React.Dispatch<RouteAction>;
  waypoints: Waypoint[];
  onFitToRoute?: (waypoints: Waypoint[]) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

type Step = 'chooser' | 'strava-url';
type StravaError = 'insufficient_scope' | 'not_found' | 'network' | null;

function parseRouteId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/strava\.com\/routes\/(\d+)/i);
  return match ? match[1] : null;
}

function isShortLink(input: string): boolean {
  return /strava\.app\.link\//i.test(input.trim());
}

export default function ImportRoutePopover({
  anchorRect,
  onClose,
  dispatch,
  waypoints,
  onFitToRoute,
  fileInputRef,
}: ImportRoutePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('chooser');
  const [urlInput, setUrlInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [stravaError, setStravaError] = useState<StravaError>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    popoverRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === 'strava-url') {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [step]);

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

  const handleGpxClick = useCallback(() => {
    fileInputRef.current?.click();
    onClose();
  }, [fileInputRef, onClose]);

  const handleStravaImport = useCallback(async () => {
    setValidationError(null);

    const trimmed = urlInput.trim();
    const isShort = isShortLink(trimmed);
    const directId = parseRouteId(trimmed);

    if (!directId && !isShort) {
      setValidationError('Invalid route URL');
      return;
    }

    if (
      waypoints.length > 0 &&
      !window.confirm('Replace the current route with the imported route?')
    ) {
      return;
    }

    setLoading(true);
    setStravaError(null);

    let routeId = directId;

    if (isShort) {
      try {
        const resolveRes = await fetch(`/api/strava-resolve?url=${encodeURIComponent(trimmed)}`);
        if (!resolveRes.ok) {
          setStravaError('not_found');
          return;
        }
        const resolved = await resolveRes.json() as { id?: string; error?: string };
        if (!resolved.id) {
          setStravaError('not_found');
          return;
        }
        routeId = resolved.id;
      } catch {
        setStravaError('network');
        return;
      }
    }

    try {
      const res = await fetch(`/api/strava-route/${routeId}`);

      if (res.status === 401) {
        setStravaError('insufficient_scope');
        return;
      }
      if (res.status === 403) {
        setStravaError('insufficient_scope');
        return;
      }
      if (res.status === 404) {
        setStravaError('not_found');
        return;
      }
      if (!res.ok) {
        setStravaError('network');
        return;
      }

      const data = await res.json() as { name: string; distance: number; points: [number, number][] };
      const rawWaypoints: Waypoint[] = data.points.map(([lat, lng]) => ({ lat, lng }));
      const { waypoints: viaPoints, segments: viaSegments } = selectGpxWaypoints(rawWaypoints, 2);

      if (viaPoints.length >= 1) {
        dispatch({ type: 'LOAD', waypoints: viaPoints, segments: viaSegments as RouteSegment[] });
        onFitToRoute?.(viaPoints);
        onClose();
      }
    } catch {
      setStravaError('network');
    } finally {
      setLoading(false);
    }
  }, [urlInput, waypoints, dispatch, onFitToRoute, onClose]);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleStravaImport();
  }, [loading, handleStravaImport]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
    setValidationError(null);
    setStravaError(null);
  }, []);

  // Position: below anchor, flip above if too close to bottom
  const POPOVER_WIDTH = 280;
  const POPOVER_HEIGHT = step === 'chooser' ? 130 : 180;
  const left = Math.min(
    Math.max(8, anchorRect.left),
    (typeof window !== 'undefined' ? window.innerWidth : 400) - POPOVER_WIDTH - 8,
  );
  const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - anchorRect.bottom : 400;
  const top = spaceBelow < POPOVER_HEIGHT + 16
    ? anchorRect.top - POPOVER_HEIGHT - 8
    : anchorRect.bottom + 8;

  const shellStyle: React.CSSProperties = {
    position: 'fixed',
    top,
    left,
    width: POPOVER_WIDTH,
    background: 'var(--glass-hvy)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid var(--p3)',
    borderRadius: 8,
    padding: 14,
    zIndex: 9999,
    boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
    outline: 'none',
  };

  return (
    <div ref={popoverRef} tabIndex={-1} role="dialog" aria-modal="true" style={shellStyle}>
      {step === 'chooser' ? (
        <>
          <Header title="Import Route" onClose={onClose} />
          <div style={{ display: 'flex', gap: 8 }}>
            <ImportCard variant="gpx" onClick={handleGpxClick} />
            <ImportCard variant="strava" onClick={() => setStep('strava-url')} />
          </div>
        </>
      ) : (
        <>
          <Header
            title="Strava Route"
            showBack
            onBack={() => { setStep('chooser'); setStravaError(null); setValidationError(null); }}
            onClose={onClose}
          />

          {stravaError === 'insufficient_scope' ? (
            <div style={{ background: 'rgba(224,112,32,0.08)', border: '1px solid rgba(224,112,32,0.3)', borderRadius: 4, padding: '10px 12px' }}>
              <p style={{ font: '500 9px/1.5 var(--mono)', color: 'var(--ora)', letterSpacing: '.04em', marginBottom: 8 }}>
                Route access requires re-linking Strava.
              </p>
              <button
                onClick={() => { window.location.href = '/api/auth/strava'; }}
                style={{ background: 'none', border: '1px solid var(--ora)', borderRadius: 3, color: 'var(--ora)', font: '700 9px/1 var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 10px', cursor: 'pointer' }}
              >
                Reconnect Strava
              </button>
            </div>
          ) : (
            <>
              <p style={{ font: '400 9px/1 var(--mono)', color: 'var(--fog-dim)', letterSpacing: '.04em', marginBottom: 8 }}>
                Paste a strava.com/routes URL
              </p>
              <input
                ref={inputRef}
                type="text"
                value={urlInput}
                onChange={handleUrlChange}
                onKeyDown={handleUrlKeyDown}
                placeholder="strava.com/routes/1234567890"
                style={{
                  width: '100%', height: 34,
                  background: 'var(--p1)', border: `1px solid ${validationError ? '#E04040' : 'var(--p3)'}`,
                  borderRadius: 4, font: '400 16px/1 var(--mono)', color: 'var(--ice)',
                  padding: '0 10px', outline: 'none',
                  boxShadow: validationError ? '0 0 0 2px rgba(224,64,64,0.15)' : 'none',
                }}
              />
              {validationError && (
                <p style={{ font: '500 9px/1 var(--mono)', color: '#E04040', letterSpacing: '.04em', marginTop: 4 }}>
                  {validationError}
                </p>
              )}
              {stravaError === 'not_found' && (
                <p style={{ font: '500 9px/1.5 var(--mono)', color: '#E06060', letterSpacing: '.04em', marginTop: 6, background: 'rgba(224,64,64,0.07)', border: '1px solid rgba(224,64,64,0.25)', borderRadius: 4, padding: '8px 10px' }}>
                  Route not found or not public.
                </p>
              )}
              {stravaError === 'network' && (
                <p style={{ font: '500 9px/1.5 var(--mono)', color: '#E06060', letterSpacing: '.04em', marginTop: 6, background: 'rgba(224,64,64,0.07)', border: '1px solid rgba(224,64,64,0.25)', borderRadius: 4, padding: '8px 10px' }}>
                  Network error — please try again.
                </p>
              )}
              <button
                onClick={handleStravaImport}
                disabled={loading || !urlInput.trim()}
                style={{
                  width: '100%', height: 36, marginTop: 10, borderRadius: 4, border: 'none',
                  background: loading || !urlInput.trim() ? 'var(--p3)' : 'var(--ora)',
                  color: loading || !urlInput.trim() ? 'var(--fog-dim)' : 'var(--p0)',
                  font: '700 11px/1 var(--mono)', letterSpacing: '.06em', textTransform: 'uppercase',
                  cursor: loading || !urlInput.trim() ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(120,168,184,0.2)', borderTopColor: 'var(--fog)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    Fetching…
                  </>
                ) : 'Import'}
              </button>
            </>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Header({
  title,
  showBack,
  onBack,
  onClose,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {showBack && (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fog)', font: '600 10px/1 var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← {title}
          </button>
        )}
        {!showBack && (
          <span style={{ font: '600 10px/1 var(--mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ice)' }}>
            {title}
          </span>
        )}
      </span>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fog-dim)', padding: 2, lineHeight: 0 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

function ImportCard({ variant, onClick }: { variant: 'gpx' | 'strava'; onClick: () => void }) {
  const isStrava = variant === 'strava';
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, height: 76, background: 'var(--p2)',
        border: '1px solid var(--p3)',
        // inset box-shadow rather than borderLeft so both cards have identical 1px borders
        // (avoids shorthand/longhand conflict and keeps card widths equal)
        boxShadow: isStrava ? 'inset 3px 0 0 var(--ora)' : 'none',
        borderRadius: 6, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 5,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = 'var(--p3)';
        el.style.borderColor = isStrava ? 'rgba(224,112,32,0.6)' : 'var(--fog)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = 'var(--p2)';
        el.style.borderColor = 'var(--p3)';
      }}
    >
      {isStrava ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ora)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ) : (
        <Upload size={18} color="var(--fog)" />
      )}
      <span style={{ font: '700 9px/1 var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ice)' }}>
        {isStrava ? 'Strava' : 'GPX File'}
      </span>
      <span style={{ font: '400 8px/1 var(--mono)', letterSpacing: '.06em', color: 'var(--fog-dim)' }}>
        {isStrava ? 'paste route URL' : 'from device'}
      </span>
    </button>
  );
}
