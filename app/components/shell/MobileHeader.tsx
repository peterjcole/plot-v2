'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { type PanelMode } from '@/app/components/shell/MapShell';
import { getActivityColor } from '@/lib/activity-categories';

interface MobileHeaderProps {
  avatarInitials?: string;
  isLoggedIn?: boolean;
  activeTab?: 'activities' | 'planner';
  onTabChange?: (tab: 'activities' | 'planner') => void;
  mode?: PanelMode;
  activityName?: string;
  activityType?: string;
  onBack?: () => void;
  onAbout?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  VirtualRide: 'Ride', EBikeRide: 'Ride', VirtualRun: 'Run',
  AlpineSki: 'Ski', NordicSki: 'Ski', BackcountrySki: 'Ski', Snowboard: 'Snow',
};

function typeLabel(type: string | undefined): string {
  if (!type) return '?';
  return TYPE_LABELS[type] ?? type;
}

export default function MobileHeader({
  avatarInitials = '?',
  isLoggedIn = false,
  activeTab = 'activities',
  onTabChange,
  mode = 'browse',
  activityName,
  activityType,
  onBack,
  onAbout,
}: MobileHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration guard
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const isDetail = mode === 'detail';

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      left: 10,
      right: 10,
      height: 48,
      background: 'var(--glass-hvy)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid var(--p3)',
      borderRadius: 999,
      boxShadow: '0 2px 12px rgba(0,0,0,.22)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px 0 16px',
      zIndex: 30,
      touchAction: 'none',
    }}>
      {isDetail ? (
        /* ── Detail capsule: back · title · type chip ── */
        <>
          <button
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fog)', cursor: 'pointer', flexShrink: 0, padding: 0,
              marginLeft: -6,
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{
            flex: 1,
            font: '600 12px/1.3 var(--mono)',
            color: 'var(--ice)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            margin: '0 8px',
          }}>
            {activityName ?? 'Activity'}
          </div>
          {activityType && (
            <div style={{
              flexShrink: 0,
              height: 22, padding: '0 10px',
              background: `${getActivityColor(activityType)}22`,
              border: `1px solid ${getActivityColor(activityType)}`,
              borderRadius: 999,
              font: '600 9px/22px var(--mono)',
              letterSpacing: '.1em', textTransform: 'uppercase',
              color: getActivityColor(activityType),
            }}>
              {typeLabel(activityType)}
            </div>
          )}
        </>
      ) : (
        /* ── Browse / Planner capsule: wordmark · tabs · status · avatar ── */
        <>
          <span style={{
            fontFamily: 'var(--display)',
            fontSize: 20, color: 'var(--ice)',
            lineHeight: 1, flexShrink: 0,
            marginRight: 2,
          }}>
            plot
          </span>

          <div style={{ width: 1, height: 22, background: 'var(--p3)', margin: '0 12px', flexShrink: 0 }} />

          {/* Tab pills — fixed-width with sliding orange indicator */}
          <div style={{ position: 'relative', display: 'flex', gap: 3, alignItems: 'center', flex: 1 }}>
            <div style={{
              position: 'absolute',
              top: 0, height: '100%',
              left: activeTab === 'activities' ? 0 : 78, width: 75,
              background: 'var(--ora)', borderRadius: 999,
              transition: 'left 0.22s cubic-bezier(.4,0,.2,1)',
              pointerEvents: 'none',
            }} />
            <button
              onClick={() => onTabChange?.('activities')}
              style={{
                width: 75, height: 26, borderRadius: 999,
                background: 'transparent', border: 'none',
                font: '600 8px/1 var(--mono)', letterSpacing: '.11em', textTransform: 'uppercase',
                color: activeTab === 'activities' ? '#fff' : 'var(--fog-dim)',
                cursor: 'pointer', flexShrink: 0, position: 'relative', zIndex: 1,
                transition: 'color 0.22s ease',
              }}
            >
              Activities
            </button>
            <button
              onClick={() => onTabChange?.('planner')}
              style={{
                width: 75, height: 26, borderRadius: 999,
                background: 'transparent', border: 'none',
                font: '600 8px/1 var(--mono)', letterSpacing: '.11em', textTransform: 'uppercase',
                color: activeTab === 'planner' ? '#fff' : 'var(--fog-dim)',
                cursor: 'pointer', flexShrink: 0, position: 'relative', zIndex: 1,
                transition: 'color 0.22s ease',
              }}
            >
              Planner
            </button>
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--p3)', margin: '0 8px', flexShrink: 0 }} />

          {/* Avatar + dropdown */}
          {mounted && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="User menu"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isLoggedIn ? 'var(--ora)' : 'var(--p3)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  color: isLoggedIn ? '#fff' : 'var(--fog-dim)',
                  fontFamily: 'var(--mono)', border: 'none', cursor: 'pointer',
                }}
              >
                {avatarInitials.slice(0, 2).toUpperCase()}
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 34, right: 0, zIndex: 50,
                  background: 'var(--p2)', border: '1px solid var(--p3)',
                  borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  minWidth: 120, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setMenuOpen(false); onAbout?.(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 14px',
                      fontSize: 12, fontFamily: 'var(--mono)',
                      color: 'var(--fog)', background: 'transparent', border: 'none',
                      textAlign: 'left', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--p3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    About
                  </button>
                  {isLoggedIn ? (
                    <a
                      href="/api/auth/logout"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)',
                        color: 'var(--fog)', textDecoration: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--p3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Log out
                    </a>
                  ) : (
                    <a
                      href="/api/auth/strava"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 14px', fontSize: 12, fontFamily: 'var(--mono)',
                        color: 'var(--fog)', textDecoration: 'none',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--p3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                        <polyline points="10 17 15 12 10 7"/>
                        <line x1="15" y1="12" x2="3" y2="12"/>
                      </svg>
                      Log in
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
