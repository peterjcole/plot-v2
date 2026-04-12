'use client';

import { useEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { type Theme } from '@/lib/theme';

interface MobileHeaderProps {
  avatarInitials?: string;
  isLoggedIn?: boolean;
  theme?: Theme;
  onThemeChange?: (t: Theme) => void;
  onAbout?: () => void;
}

export default function MobileHeader({ avatarInitials = '?', isLoggedIn = false, theme = 'system', onThemeChange, onAbout }: MobileHeaderProps) {
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

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: 60,
      background: 'var(--glass)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      zIndex: 30,
      borderBottom: '1px solid var(--p3)',
      touchAction: 'none',
    }}>
      <span style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--ice)', lineHeight: 1, marginRight: 12 }}>
        plot
      </span>

      {mounted && onThemeChange && (
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      )}

      <div style={{ flex: 1 }} />

      {mounted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onAbout}
            aria-label="About plot"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              border: '1px solid var(--fog-ghost)',
              background: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fog-dim)', flexShrink: 0, cursor: 'pointer', padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>

          <div ref={menuRef} style={{ position: 'relative' }}>
            {isLoggedIn ? (
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="User menu"
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--ora)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'var(--mono)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                {avatarInitials.slice(0, 2).toUpperCase()}
              </button>
            ) : (
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--p3)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--fog-dim)', fontFamily: 'var(--mono)',
              }}>
                {avatarInitials.slice(0, 2).toUpperCase()}
              </div>
            )}

            {menuOpen && (
              <div style={{
                position: 'absolute', top: 36, right: 0, zIndex: 50,
                background: 'var(--p2)', border: '1px solid var(--p3)',
                borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                minWidth: 120, overflow: 'hidden',
              }}>
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
