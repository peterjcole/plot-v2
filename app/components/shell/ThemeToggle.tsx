'use client';

import { type Theme } from '@/lib/theme';

interface ThemeToggleProps {
  theme: Theme;
  onChange: (t: Theme) => void;
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Sys' },
  { value: 'light', label: 'Light' },
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
      {THEMES.map(({ value, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-label={`${label} theme`}
            aria-pressed={active}
            style={{
              background: active ? 'var(--ora)' : 'transparent',
              color: active ? '#fff' : 'var(--fog-dim)',
              border: 'none',
              borderRadius: 16,
              padding: '3px 8px',
              fontFamily: 'var(--mono)',
              fontSize: 9,
              fontWeight: active ? 600 : 400,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
