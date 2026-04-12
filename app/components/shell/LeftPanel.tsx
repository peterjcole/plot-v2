'use client';

import StatusBar from './StatusBar';
import ThemeToggle from './ThemeToggle';
import { type Theme } from '@/lib/theme';

type Tab = 'activities' | 'planner';

interface LeftPanelProps {
  avatarInitials?: string;
  isLoggedIn?: boolean;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  theme?: Theme;
  onThemeChange?: (t: Theme) => void;
  onAbout?: () => void;
  children?: React.ReactNode;
}

export default function LeftPanel({ avatarInitials, isLoggedIn = false, activeTab = 'activities', onTabChange, theme = 'system', onThemeChange, onAbout, children }: LeftPanelProps) {

  return (
    <div
      style={{
        width: 'var(--panel-w)',
        height: '100%',
        background: 'var(--p1)',
        borderRight: '1px solid var(--p3)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <StatusBar avatarInitials={avatarInitials} isLoggedIn={isLoggedIn} />

      {/* Wordmark */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          borderBottom: '1px solid var(--fog-ghost)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--display)',
            fontSize: 24,
            color: 'var(--ice)',
            lineHeight: 1,
          }}
        >
          plot
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ThemeToggle theme={theme} onChange={onThemeChange ?? (() => {})} />
          <button
            onClick={onAbout}
            aria-label="About plot"
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'none', border: '1px solid var(--fog-ghost)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--fog-dim)', flexShrink: 0,
              padding: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          height: 36,
          display: 'flex',
          borderBottom: '1px solid var(--fog-ghost)',
          flexShrink: 0,
        }}
      >
        {(['activities', 'planner'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange?.(tab)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--ora)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--ice)' : 'var(--fog-dim)',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              fontWeight: activeTab === tab ? 600 : 400,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1,
            }}
          >
            {tab === 'activities' ? 'Activities' : 'Planner'}
          </button>
        ))}
      </div>

      {/* Panel content slot */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
