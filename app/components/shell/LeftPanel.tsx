'use client';

import { useState } from 'react';
import StatusBar from './StatusBar';

type Tab = 'activities' | 'planner';

interface LeftPanelProps {
  avatarInitials?: string;
  children?: React.ReactNode;
}

export default function LeftPanel({ avatarInitials, children }: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('activities');

  return (
    <div
      style={{
        width: 'var(--panel-w)',
        height: '100%',
        background: 'var(--p1)',
        borderRight: '1px solid var(--fog-ghost)',
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
            onClick={() => setActiveTab(tab)}
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
