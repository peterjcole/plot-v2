'use client';

import StatusBar from './StatusBar';
import ThemeToggle from './ThemeToggle';
import { type Theme } from '@/lib/theme';

type Tab = 'activities' | 'planner';

interface LeftPanelProps {
  avatarInitials?: string;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  theme?: Theme;
  onThemeChange?: (t: Theme) => void;
  children?: React.ReactNode;
}

export default function LeftPanel({ avatarInitials, activeTab = 'activities', onTabChange, theme = 'system', onThemeChange, children }: LeftPanelProps) {

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
      <StatusBar avatarInitials={avatarInitials} />

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
        <ThemeToggle theme={theme} onChange={onThemeChange ?? (() => {})} />
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
