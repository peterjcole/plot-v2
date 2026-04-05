'use client';

import { useEffect, useState } from 'react';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--grn)', boxShadow: '0 0 5px var(--grn)',
            display: 'inline-block',
          }} />
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
