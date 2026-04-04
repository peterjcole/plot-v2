'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ActivitySummary, ActivityData } from '@/lib/types';
import { type MapLayer } from '@/app/components/MainMap';
import LeftPanel from './LeftPanel';
import BrowsePanel from './BrowsePanel';
import DetailPanel from './DetailPanel';
import UnauthPanel from './UnauthPanel';
import MobileHeader from './MobileHeader';
import MobileLegend from './MobileLegend';
import MobileBottomSheet from './MobileBottomSheet';

const MainMap = dynamic(() => import('@/app/components/MainMap'), { ssr: false });

export type PanelMode = 'browse' | 'detail' | 'planner';

function LayerToggle({ baseLayer, onBaseLayerChange, bottom, fixed }: {
  baseLayer: MapLayer;
  onBaseLayerChange: (l: MapLayer) => void;
  bottom: number;
  fixed?: boolean;
}) {
  return (
    <div style={{
      position: fixed ? 'fixed' : 'absolute',
      bottom,
      right: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      zIndex: 15,
    }}>
      {(['topo', 'satellite'] as MapLayer[]).map((l) => (
        <button
          key={l}
          onClick={() => onBaseLayerChange(l)}
          title={l === 'topo' ? 'Topo' : 'Satellite'}
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            border: `1px solid ${baseLayer === l ? 'var(--ora)' : 'var(--p3)'}`,
            background: baseLayer === l ? 'rgba(224,112,32,0.18)' : 'rgba(7,14,20,0.75)',
            color: baseLayer === l ? 'var(--ora)' : 'var(--fog-dim)',
            fontFamily: 'var(--mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          {l === 'topo' ? 'T' : 'S'}
        </button>
      ))}
    </div>
  );
}

interface MapShellProps {
  activities: ActivitySummary[];
  avatarInitials: string;
  isLoggedIn?: boolean;
}

export default function MapShell({ activities, avatarInitials, isLoggedIn = false }: MapShellProps) {
  const [mode, setMode] = useState<PanelMode>('browse');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityDetail, setActivityDetail] = useState<ActivityData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [baseLayer, setBaseLayer] = useState<MapLayer>('topo');
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection (client-side only to avoid hydration mismatch)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Fetch full activity detail when selection changes
  useEffect(() => {
    if (!selectedId) { setActivityDetail(null); return; }
    setDetailLoading(true);
    fetch(`/api/activities/${selectedId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: ActivityData) => { setActivityDetail(data); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedId]);

  const handleSelectActivity = useCallback((id: string) => {
    setSelectedId(id);
    setMode('detail');
  }, []);

  const handleBack = useCallback(() => {
    setMode('browse');
    setSelectedId(null);
    setActivityDetail(null);
  }, []);

  const handleTabChange = useCallback((tab: 'activities' | 'planner') => {
    if (tab === 'planner') setMode('planner');
    else if (mode === 'planner') setMode('browse');
  }, [mode]);

  const activeTab = mode === 'planner' ? 'planner' : 'activities';
  const photoMarkers = activityDetail?.photos ?? undefined;

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--p0)' }}>
        <LeftPanel
          avatarInitials={avatarInitials}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        >
          {mode === 'browse' && (
            isLoggedIn
              ? <BrowsePanel activities={activities} selectedId={selectedId} onSelectActivity={handleSelectActivity} />
              : <UnauthPanel />
          )}
          {mode === 'detail' && (
            detailLoading || !activityDetail ? (
              <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
                {detailLoading ? 'Loading…' : 'No data'}
              </div>
            ) : (
              <DetailPanel activity={activityDetail} onBack={handleBack} />
            )
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
            photoMarkers={photoMarkers}
            onActivitySelect={handleSelectActivity}
            baseLayer={baseLayer}
            onBaseLayerChange={setBaseLayer}
          />
          <LayerToggle baseLayer={baseLayer} onBaseLayerChange={setBaseLayer} bottom={16} />
        </div>
      </div>
    );
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  const sheetTitle = mode === 'detail' && activityDetail ? activityDetail.name : 'Activities';
  const sheetCount = mode === 'browse' && isLoggedIn ? activities.length : undefined;

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--p0)' }}>
      {/* Full-bleed map */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MainMap
          activities={activities}
          highlightedId={selectedId}
          photoMarkers={photoMarkers}
          onActivitySelect={handleSelectActivity}
          baseLayer={baseLayer}
          onBaseLayerChange={setBaseLayer}
        />
      </div>

      <MobileHeader avatarInitials={avatarInitials} />
      <MobileLegend />

      <LayerToggle baseLayer={baseLayer} onBaseLayerChange={setBaseLayer} bottom={198} fixed />

      {/* FAB */}
      <button
        style={{
          position: 'fixed',
          right: 16,
          bottom: 142, // above collapsed sheet
          width: 48,
          height: 48,
          borderRadius: 6,
          background: 'var(--ora)',
          border: 'none',
          color: 'var(--p0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 18,
        }}
        aria-label="New route"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <MobileBottomSheet
        title={sheetTitle}
        count={sheetCount}
        forceExpanded={mode === 'detail'}
      >
        {mode === 'browse' && (
          isLoggedIn
            ? <BrowsePanel activities={activities} selectedId={selectedId} onSelectActivity={handleSelectActivity} />
            : <UnauthPanel />
        )}
        {mode === 'detail' && (
          detailLoading || !activityDetail ? (
            <div style={{ padding: 16, fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
              {detailLoading ? 'Loading…' : 'No data'}
            </div>
          ) : (
            <DetailPanel activity={activityDetail} onBack={handleBack} />
          )
        )}
      </MobileBottomSheet>
    </div>
  );
}
