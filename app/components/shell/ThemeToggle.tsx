'use client';

import React from 'react';
import { type Theme } from '@/lib/theme';

interface ThemeToggleProps {
  theme: Theme;
  onChange: (t: Theme) => void;
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2"/>
      <path d="M8 21h8m-4-4v4"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/>
    </svg>
  );
}

const THEMES: { value: Theme; label: string; Icon: () => React.ReactElement }[] = [
  { value: 'dark', label: 'Dark theme', Icon: MoonIcon },
  { value: 'system', label: 'System theme', Icon: MonitorIcon },
  { value: 'light', label: 'Light theme', Icon: SunIcon },
];

export default function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Colour theme"
      style={{
        display: 'flex',
        border: '1px solid var(--fog-ghost)',
        borderRadius: 20,
        padding: 2,
        gap: 0,
        flexShrink: 0,
      }}
    >
      {THEMES.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            suppressHydrationWarning
            onClick={() => onChange(value)}
            aria-label={label}
            aria-pressed={active}
            style={{
              background: active ? 'var(--ora)' : 'transparent',
              color: active ? '#fff' : 'var(--fog-dim)',
              border: 'none',
              borderRadius: 16,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
