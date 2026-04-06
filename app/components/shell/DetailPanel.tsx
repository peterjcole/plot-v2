'use client';

import { ActivityData } from '@/lib/types';
import { getActivityColor, getActivityCategory } from '@/lib/activity-categories';

function fmt(meters: number): string { return (meters / 1000).toFixed(2) + ' km'; }
function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtElev(m: number): string { return Math.round(m) + ' m'; }
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface StatCellProps { label: string; value: string | undefined }
function StatCell({ label, value }: StatCellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: value ? 'var(--ice)' : 'var(--fog-ghost)', fontFamily: 'var(--mono)' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

interface DetailPanelProps {
  activity: ActivityData;
  onBack: () => void;
  onOpenPlanner?: () => void;
  onPhotoClick?: (index: number) => void;
}

export default function DetailPanel({ activity, onBack, onOpenPlanner, onPhotoClick }: DetailPanelProps) {
  const color = getActivityColor(getActivityCategory(activity.type ?? ''));
  const { stats } = activity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px 10px',
        borderBottom: '1px solid var(--fog-ghost)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'var(--fog-dim)',
            fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: 8,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ width: 3, height: 36, background: color, flexShrink: 0, borderRadius: 2, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ice)', fontFamily: 'var(--mono)', lineHeight: 1.3 }}>
              {activity.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginTop: 3 }}>
              {activity.type ?? ''}{activity.type && stats.startDate ? ' · ' : ''}{stats.startDate ? fmtDate(stats.startDate) : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 20px' }}>

        {/* Photos strip — first */}
        {activity.photos.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
              Photos
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {activity.photos.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => onPhotoClick?.(i)}
                  aria-label={`Open photo ${i + 1}${photo.caption ? ': ' + photo.caption : ''}`}
                  style={{
                    width: 80, height: 60, flexShrink: 0, borderRadius: 4,
                    background: 'var(--p2)', overflow: 'hidden', position: 'relative',
                    border: '1px solid var(--fog-ghost)',
                    padding: 0, cursor: onPhotoClick ? 'pointer' : 'default',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? 'Activity photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  {(photo.lat !== 0 || photo.lng !== 0) && (
                    <div style={{
                      position: 'absolute', bottom: 3, right: 3,
                      background: 'rgba(7,14,20,0.7)', borderRadius: 3, padding: '1px 3px',
                    }}>
                      <svg width="8" height="10" viewBox="0 0 20 28" fill="none">
                        <path d="M10 27c-2-6-9-11-9-17a9 9 0 1 1 18 0c0 6-7 11-9 17Z" fill="var(--ora)" stroke="rgba(240,248,250,0.5)" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="3.5" fill="rgba(240,248,250,0.9)"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            Stats
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <StatCell label="Distance" value={fmt(stats.distance)} />
            <StatCell label="Moving Time" value={fmtTime(stats.movingTime)} />
            <StatCell label="Elevation" value={fmtElev(stats.elevationGain)} />
            <StatCell label="Avg HR" value={stats.avgHeartrate ? `${Math.round(stats.avgHeartrate)} bpm` : undefined} />
            <StatCell label="High Point" value={stats.elevHigh ? fmtElev(stats.elevHigh) : undefined} />
            <StatCell label="Calories" value={stats.calories ? `${stats.calories} kcal` : undefined} />
          </div>
        </div>

        {/* Gear */}
        {activity.gear && (
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fog-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--fog)', fontFamily: 'var(--mono)' }}>
              {activity.gear}
            </span>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 16 }} />

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onOpenPlanner && (
            <button
              onClick={onOpenPlanner}
              style={{
                width: '100%', padding: '9px 12px',
                background: 'var(--ora)', border: 'none', borderRadius: 4,
                color: 'var(--p0)', fontFamily: 'var(--mono)', fontSize: 11,
                fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              Open in Planner
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={`/api/activity-gpx/${activity.id}`}
              download
              style={{
                flex: 1, padding: '8px 12px', textAlign: 'center',
                border: '1px solid var(--p3)', borderRadius: 4,
                color: 'var(--fog)', fontFamily: 'var(--mono)', fontSize: 10,
                fontWeight: 500, textDecoration: 'none', letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              GPX
            </a>
            <a
              href={`/api/activity-printout?activityId=${activity.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, padding: '8px 12px', textAlign: 'center',
                border: '1px solid var(--p3)', borderRadius: 4,
                color: 'var(--fog)', fontFamily: 'var(--mono)', fontSize: 10,
                fontWeight: 500, textDecoration: 'none', letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              Image
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
