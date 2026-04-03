'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ActivitySummary } from '@/lib/types';
import LeftPanel from './LeftPanel';
import BrowsePanel from './BrowsePanel';

const MainMap = dynamic(() => import('@/app/components/MainMap'), { ssr: false });

export type PanelMode = 'browse' | 'detail' | 'planner';

interface MapShellProps {
  activities: ActivitySummary[];
  avatarInitials: string;
}

export default function MapShell({ activities, avatarInitials }: MapShellProps) {
  const [mode, setMode] = useState<PanelMode>('browse');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelectActivity = useCallback((id: string) => {
    setSelectedId(id);
    setMode('detail');
  }, []);

  const handleTabChange = useCallback((tab: 'activities' | 'planner') => {
    if (tab === 'planner') {
      setMode('planner');
    } else {
      setMode(mode === 'planner' ? 'browse' : mode);
    }
  }, [mode]);

  const activeTab = mode === 'planner' ? 'planner' : 'activities';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--p0)' }}>
      <LeftPanel
        avatarInitials={avatarInitials}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      >
        {mode === 'browse' && (
          <BrowsePanel
            activities={activities}
            selectedId={selectedId}
            onSelectActivity={handleSelectActivity}
          />
        )}
        {mode === 'detail' && (
          <div style={{ padding: 12 }}>
            <button
              onClick={() => { setMode('browse'); setSelectedId(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--fog)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
                marginBottom: 12,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Back
            </button>
            <p style={{ fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
              Activity detail coming in Phase 3
            </p>
          </div>
        )}
        {mode === 'planner' && (
          <div style={{ padding: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
              Planner coming in Phase 4
            </p>
          </div>
        )}
      </LeftPanel>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MainMap
          activities={activities}
          highlightedId={selectedId}
          onActivitySelect={handleSelectActivity}
        />
      </div>
    </div>
  );
}
