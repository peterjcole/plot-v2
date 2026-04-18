import { ArrowUp } from 'lucide-react';
import { ActivitySummary } from '@/lib/types';
import { getActivityCategory, getCategoryColor } from '@/lib/activity-categories';

function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(1) + ' km';
}

function formatElevation(meters: number): string {
  return Math.round(meters) + ' m';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function TypeIcon({ type, color }: { type: string; color: string }) {
  const category = getActivityCategory(type);

  if (category === 'run') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/>
        <path d="m7.5 13.5 2-2.5 2.5 2 2-3.5"/>
        <path d="M17 16.5 15 14l-3.5 3.5-2-2L7 18"/>
      </svg>
    );
  }
  if (category === 'cycle') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/>
        <path d="M6 15 10 7h4l2 4-5 1.5"/>
        <path d="m10 7 2 8"/>
      </svg>
    );
  }
  // hike / other — mountain
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
    </svg>
  );
}

interface ActivityCardProps {
  activity: ActivitySummary;
  onClick: (id: string) => void;
  isSelected?: boolean;
  isHovered?: boolean;
  onHover?: (id: string | null) => void;
}

export default function ActivityCard({ activity, onClick, isSelected, isHovered, onHover }: ActivityCardProps) {
  const color = getCategoryColor(getActivityCategory(activity.type));
  const id = String(activity.id);

  return (
    <button
      data-activity-id={id}
      onClick={() => onClick(id)}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        background: isSelected ? 'var(--p2)' : isHovered ? 'var(--fog-ghost)' : 'none',
        border: 'none',
        borderBottom: '1px solid var(--fog-ghost)',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        transition: 'background 0.1s',
      }}
    >
      {/* Coloured left border */}
      <div style={{ width: 3, background: color, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: '9px 10px 9px 10px' }}>
        {/* Name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <TypeIcon type={activity.type} color={color} />
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--ice)',
            fontFamily: 'var(--mono)',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {activity.name}
          </span>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 8,
          fontSize: 10,
          color: 'var(--fog-dim)',
          fontFamily: 'var(--mono)',
          letterSpacing: '0.02em',
        }}>
          <span>{formatDistance(activity.distance)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>{formatElevation(activity.elevationGain)}<ArrowUp size={9} /></span>
          <span style={{ marginLeft: 'auto' }}>{formatDate(activity.startDate)}</span>
        </div>
      </div>
    </button>
  );
}
