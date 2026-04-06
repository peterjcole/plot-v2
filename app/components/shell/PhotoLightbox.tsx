'use client';

import { useEffect, useRef, useState } from 'react';
import { ActivityPhoto } from '@/lib/types';

interface PhotoLightboxProps {
  photos: ActivityPhoto[];
  initialIndex: number;
  onClose: () => void;
}

export default function PhotoLightbox({ photos, initialIndex, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const photo = photos[index];
  const total = photos.length;

  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  // Capture focus target to restore on close, then focus close button
  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus();
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,8,12,0.92)' }} />

      {/* ── Desktop layout (>640px) ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '20px 48px',
        boxSizing: 'border-box',
      }}>
        {/* Counter */}
        <div style={{
          position: 'absolute', top: 16, left: 20,
          fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)',
        }}>
          <span aria-live="polite">{index + 1} / {total}</span>
        </div>

        {/* Close */}
        <button
          ref={closeRef}
          data-lightbox-close
          onClick={onClose}
          aria-label="Close photo viewer"
          style={{
            position: 'absolute', top: 12, right: 16,
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Prev arrow */}
        {total > 1 && (
          <button
            onClick={prev}
            aria-label="Previous photo"
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--glass)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              border: '1px solid var(--fog-ghost)', color: 'var(--fog)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
        )}

        {/* Next arrow */}
        {total > 1 && (
          <button
            onClick={next}
            aria-label="Next photo"
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--glass)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
              border: '1px solid var(--fog-ghost)', color: 'var(--fog)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        )}

        {/* Main photo */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={photo.url}
            alt={photo.caption ?? 'Activity photo'}
            style={{
              maxWidth: 'min(848px, 90vw)',
              maxHeight: 'calc(100vh - 200px)',
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
          {photo.caption && (
            <p style={{
              maxWidth: 'min(848px, 90vw)', width: '100%',
              fontSize: 11, color: 'var(--fog)', fontFamily: 'var(--mono)',
              marginTop: 10, textAlign: 'left',
            }}>
              {photo.caption}
            </p>
          )}
        </div>

        {/* Thumbnail strip (desktop only, hidden on mobile) */}
        {total > 1 && (
          <div style={{
            display: 'flex', gap: 6, flexShrink: 0, marginTop: 12,
            maxWidth: 'min(848px, 90vw)', overflowX: 'auto', paddingBottom: 2,
          }}>
            {photos.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1}${p.caption ? ': ' + p.caption : ''}`}
                style={{
                  width: 58, height: 38, flexShrink: 0, padding: 0,
                  border: i === index ? '2px solid var(--ora)' : '2px solid transparent',
                  borderRadius: 3, overflow: 'hidden', cursor: 'pointer', background: 'none',
                  opacity: i === index ? 1 : 0.55, transition: 'opacity 0.15s, border-color 0.15s',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
