'use client';

import { useEffect, useState, useRef } from 'react';

interface StatusBarProps {
  avatarInitials?: string;
  isLoggedIn?: boolean;
}

export default function StatusBar({ avatarInitials = '?', isLoggedIn = false }: StatusBarProps) {
  const [time, setTime] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Close menu on outside click
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
    <div
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: 6,
        background: 'var(--p0)',
        borderBottom: '1px solid var(--fog-ghost)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Time */}
      <span style={{ fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
        {time}
      </span>

      <div style={{ flex: 1 }} />

      {/* Sync indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--grn)',
            boxShadow: '0 0 5px var(--grn)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.02em' }}>synced</span>
      </div>

      {/* Avatar / user menu */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        {isLoggedIn ? (
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label="User menu"
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--ora)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: 'var(--mono)',
              letterSpacing: 0, border: 'none', cursor: 'pointer',
            }}
          >
            {avatarInitials.slice(0, 2).toUpperCase()}
          </button>
        ) : (
          <div
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: 'var(--p3)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: 'var(--fog-dim)', fontFamily: 'var(--mono)',
              letterSpacing: 0,
            }}
          >
            {avatarInitials.slice(0, 2).toUpperCase()}
          </div>
        )}

        {menuOpen && (
          <div style={{
            position: 'absolute', top: 26, right: 0, zIndex: 50,
            background: 'var(--p2)', border: '1px solid var(--p3)',
            borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            minWidth: 120, overflow: 'hidden',
          }}>
            <a
              href="/api/auth/logout"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', fontSize: 11, fontFamily: 'var(--mono)',
                color: 'var(--fog)', textDecoration: 'none', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--p3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  );
}
