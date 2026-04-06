'use client';

import { useState, useMemo, useEffect } from 'react';
import { ActivitySummary } from '@/lib/types';
import { getActivityCategory, ActivityCategory } from '@/lib/activity-categories';
import ActivityCard from './ActivityCard';

type Filter = 'all' | 'run' | 'hike' | 'cycle';

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  run: 'Runs',
  hike: 'Hikes',
  cycle: 'Cycles',
};

interface BrowsePanelProps {
  activities: ActivitySummary[];
  selectedId: string | null;
  onSelectActivity: (id: string) => void;
  hoveredId?: string | null;
  onHoverActivity?: (id: string | null) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  authError?: boolean;
}

export default function BrowsePanel({ activities, selectedId, onSelectActivity, hoveredId, onHoverActivity, hasMore, isLoadingMore, onLoadMore, authError }: BrowsePanelProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Scroll card into view when a trace is hovered on the map
  useEffect(() => {
    if (!hoveredId) return;
    document.querySelector(`[data-activity-id="${hoveredId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hoveredId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (filter !== 'all' && getActivityCategory(a.type) !== (filter as ActivityCategory)) return false;
      if (q && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activities, search, filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ padding: '8px 10px 6px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <svg
            width="12" height="12"
            viewBox="0 0 24 24" fill="none" stroke="var(--fog-dim)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            placeholder="Search activities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--p2)',
              border: '1px solid var(--fog-ghost)',
              borderRadius: 4,
              padding: '5px 8px 5px 26px',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--ice)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Filter chips */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '0 10px 8px',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '3px 9px',
              borderRadius: 20,
              border: filter === f ? '1px solid var(--ora)' : '1px solid var(--fog-ghost)',
              background: filter === f ? 'rgba(224,112,32,0.12)' : 'none',
              color: filter === f ? 'var(--ora)' : 'var(--fog-dim)',
              fontSize: 10,
              fontFamily: 'var(--mono)',
              fontWeight: filter === f ? 600 : 400,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Auth error banner */}
      {authError && (
        <div
          role="alert"
          style={{
            margin: '8px 10px',
            padding: '10px 12px',
            background: 'rgba(224,112,32,0.08)',
            border: '1px solid rgba(224,112,32,0.3)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ora)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ice)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
              Session expired
            </div>
            <a
              href="/api/auth/strava"
              style={{ fontSize: 10, color: 'var(--ora)', fontFamily: 'var(--mono)', textDecoration: 'none', letterSpacing: '0.04em' }}
            >
              Reconnect Strava →
            </a>
          </div>
        </div>
      )}

      {/* Activity list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', padding: '16px 12px' }}>
            No activities found.
          </p>
        ) : (
          filtered.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              onClick={onSelectActivity}
              isSelected={selectedId === String(a.id)}
              isHovered={hoveredId === String(a.id)}
              onHover={onHoverActivity}
            />
          ))
        )}
        {/* Load more — shown when more server pages exist and no active text search */}
        {hasMore && !search.trim() && (
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            aria-label={isLoadingMore ? 'Loading more activities' : 'Load more activities'}
            style={{
              width: '100%',
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderTop: '1px solid var(--fog-ghost)',
              color: isLoadingMore ? 'var(--fog-ghost)' : 'var(--fog-dim)',
              fontSize: 10,
              fontFamily: 'var(--mono)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: isLoadingMore ? 'default' : 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
