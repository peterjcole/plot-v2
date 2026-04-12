'use client';

import { useEffect, useState } from 'react';

// Topographic contour paths — irregular closed curves at different elevations
// Generated to look like real OS-style contour lines, not generic circles
const CONTOURS = [
  'M 180 240 C 220 180, 340 160, 420 200 C 510 245, 560 310, 520 380 C 480 450, 360 480, 260 460 C 150 440, 110 360, 140 290 C 155 260, 165 255, 180 240 Z',
  'M 160 220 C 210 145, 370 120, 470 170 C 570 220, 630 310, 580 410 C 530 510, 370 545, 240 520 C 100 490, 55 380, 95 280 C 115 240, 140 230, 160 220 Z',
  'M 140 195 C 200 110, 400 75, 520 140 C 640 205, 710 315, 650 440 C 590 565, 390 610, 220 580 C 45 548, -10 410, 45 280 C 70 220, 115 205, 140 195 Z',
  'M 350 80 C 440 60, 570 90, 650 160 C 730 230, 750 340, 700 430 C 645 525, 520 570, 390 560 C 255 548, 150 485, 130 370 C 110 260, 180 130, 250 95 C 290 80, 320 82, 350 80 Z',
  'M 90 160 C 150 60, 360 20, 530 80 C 700 140, 800 290, 760 460 C 720 630, 540 700, 340 680 C 130 658, -20 530, 10 340 C 25 245, 60 195, 90 160 Z',
  'M 420 40 C 560 20, 730 80, 830 200 C 930 320, 920 490, 820 590 C 710 695, 530 730, 360 700 C 180 668, 50 560, 40 400 C 28 230, 150 90, 280 50 C 335 30, 380 42, 420 40 Z',
  'M 200 320 C 250 270, 370 255, 440 290 C 510 328, 530 400, 490 455 C 450 512, 340 530, 255 505 C 162 478, 135 400, 155 355 C 168 333, 185 328, 200 320 Z',
  'M 620 180 C 680 150, 770 170, 820 230 C 870 295, 855 390, 800 440 C 740 492, 640 500, 575 460 C 505 418, 490 335, 535 270 C 558 235, 590 198, 620 180 Z',
];

export default function SplashOverlay({ onDismiss, onPlanRoute }: { onDismiss: () => void; onPlanRoute?: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80);
    const t2 = setTimeout(() => setPhase(2), 380);
    const t3 = setTimeout(() => setPhase(3), 680);
    const t4 = setTimeout(() => setPhase(4), 950);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const fade = (p: number): React.CSSProperties => ({
    opacity: phase >= p ? 1 : 0,
    transform: phase >= p ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.55s ease, transform 0.55s ease',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--p0)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      fontFamily: 'var(--mono)',
    }}>

      {/* ── Atmospheric background layers ───────────────────────────────── */}

      {/* Topographic SVG contours */}
      <svg
        viewBox="0 0 900 750"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0.045,
          animation: 'contour-drift 40s linear infinite',
        }}
        aria-hidden="true"
      >
        <g fill="none" stroke="var(--ice)" strokeWidth="1.2">
          {CONTOURS.map((d, i) => (
            <path key={i} d={d} strokeOpacity={1 - i * 0.07} />
          ))}
        </g>
      </svg>

      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(7,14,20,0.18) 3px, rgba(7,14,20,0.18) 4px)',
      }} />

      {/* Radial glow — centre warmth */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(224,112,32,0.06) 0%, transparent 70%)',
      }} />

      {/* Fine dot-grid texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'radial-gradient(circle, rgba(240,248,250,0.045) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ── Corner HUD readouts ──────────────────────────────────────────── */}

      {/* Top-left */}
      <div style={{
        position: 'absolute', top: 18, left: 20, zIndex: 10,
        fontSize: 9, letterSpacing: '0.14em', color: 'var(--fog-ghost)',
        lineHeight: 1.9, textTransform: 'uppercase',
        ...fade(1),
      }}>
        <div>SYSTEM / PLOT · v2</div>
        <div>STATUS · AWAITING AUTH</div>
        <div>PROVIDER · STRAVA</div>
      </div>

      {/* Top-right */}
      <div style={{
        position: 'absolute', top: 18, right: 20, zIndex: 10,
        fontSize: 9, letterSpacing: '0.14em', color: 'var(--fog-ghost)',
        lineHeight: 1.9, textTransform: 'uppercase', textAlign: 'right',
        ...fade(1),
      }}>
        <div>PROJ / BNG · EPSG:27700</div>
        <div>TILES / OS · 1:50,000</div>
        <div>MODE · UNAUTHENTICATED</div>
      </div>

      {/* Bottom-left coordinate */}
      <div style={{
        position: 'absolute', bottom: 18, left: 20, zIndex: 10,
        fontSize: 9, letterSpacing: '0.12em', color: 'var(--fog-ghost)',
        textTransform: 'uppercase',
        ...fade(4),
      }}>
        54.4°N · 2.9°W
      </div>

      {/* Bottom-right signal indicator */}
      <div style={{
        position: 'absolute', bottom: 18, right: 20, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 9, letterSpacing: '0.12em', color: 'var(--fog-ghost)',
        textTransform: 'uppercase',
        ...fade(4),
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--ora)', opacity: 0.7,
          display: 'inline-block',
          boxShadow: '0 0 6px var(--ora)',
          animation: 'blink 2s ease-in-out infinite',
        }} />
        AWAITING SIGNAL
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0,
        textAlign: 'center',
        padding: '0 24px',
        maxWidth: 480,
        width: '100%',
      }}>

        {/* Wordmark */}
        <div style={{ ...fade(1), marginBottom: 6 }}>
          <span style={{
            fontFamily: 'var(--display)',
            fontSize: 'clamp(72px, 16vw, 108px)',
            color: 'var(--ice)',
            lineHeight: 1,
            letterSpacing: '-0.01em',
            display: 'block',
            textShadow: '0 0 60px rgba(224,112,32,0.20), 0 2px 32px rgba(0,0,0,0.8)',
          }}>
            plot
          </span>
        </div>

        {/* Thin rule */}
        <div style={{
          width: 48, height: 1,
          background: 'linear-gradient(90deg, transparent, var(--ora), transparent)',
          marginBottom: 20,
          ...fade(2),
        }} />

        {/* Tagline */}
        <div style={{
          fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'var(--fog-dim)', fontFamily: 'var(--mono)',
          lineHeight: 1.7, marginBottom: 36,
          ...fade(2),
        }}>
          Strava activities on OS maps.
          <br />
          <span style={{ color: 'var(--fog-ghost)' }}>Route planning + GPX export included.</span>
        </div>

        {/* Connect CTA */}
        <a
          href="/api/auth/strava"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '12px 28px',
            background: 'var(--ora)',
            color: '#fff',
            border: 'none', borderRadius: 4,
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            textDecoration: 'none', cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(224,112,32,0.35)',
            transition: 'box-shadow 0.2s, transform 0.2s',
            marginBottom: 12,
            ...fade(3),
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 32px rgba(224,112,32,0.55)';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(224,112,32,0.35)';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
          </svg>
          Connect with Strava
        </a>

        {/* Plan a route (no login needed) */}
        {onPlanRoute && (
          <button
            onClick={onPlanRoute}
            style={{
              background: 'none',
              border: '1px solid var(--p3)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--fog)', padding: '9px 24px',
              marginBottom: 16,
              transition: 'border-color 0.2s, color 0.2s',
              ...fade(3),
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--fog-dim)';
              (e.currentTarget as HTMLElement).style.color = 'var(--ice)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--p3)';
              (e.currentTarget as HTMLElement).style.color = 'var(--fog)';
            }}
          >
            Plan a route <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}><path d="m9 18 6-6-6-6"/></svg>
          </button>
        )}

        {/* Dismiss link */}
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
            color: 'var(--fog-ghost)', textTransform: 'uppercase',
            padding: '4px 0',
            transition: 'color 0.2s',
            ...fade(4),
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--fog-dim)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--fog-ghost)')}
        >
          Peek at the map <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      <style>{`
        @keyframes contour-drift {
          0%   { transform: translate(0px, 0px) rotate(0deg); }
          25%  { transform: translate(-8px, 4px) rotate(0.3deg); }
          50%  { transform: translate(-4px, 8px) rotate(0deg); }
          75%  { transform: translate(4px, 4px) rotate(-0.3deg); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
