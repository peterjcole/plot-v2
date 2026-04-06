'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { type Theme } from '@/lib/theme';

interface MobileHeaderProps {
  avatarInitials?: string;
  theme?: Theme;
  onThemeChange?: (t: Theme) => void;
}

export default function MobileHeader({ avatarInitials = '?', theme = 'system', onThemeChange }: MobileHeaderProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: 50,
      background: 'var(--glass)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      zIndex: 30,
      borderBottom: '1px solid var(--p3)',
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
          <Link
            href="/about"
            aria-label="About plot"
            style={{
              width: 26, height: 26, borderRadius: '50%',
              border: '1px solid var(--fog-ghost)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fog-dim)', flexShrink: 0, textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </Link>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--ora)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--mono)',
          }}>
            {avatarInitials.slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}
