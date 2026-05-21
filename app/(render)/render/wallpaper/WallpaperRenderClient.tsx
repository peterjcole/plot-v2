'use client';

import dynamic from 'next/dynamic';
import { ArrowUp } from 'lucide-react';
import type { ActivityData } from '@/lib/types';
import type { BaseMap } from '@/lib/map-config';
import { fmtKm, fmtElev, fmtTime, fmtPace, fmtDate } from '@/lib/format-stats';

const ActivityMap = dynamic(() => import('@/app/components/ActivityMap'), { ssr: false });

interface WallpaperRenderClientProps {
  activity: ActivityData;
  width: number;
  height: number;
  baseMap?: BaseMap;
  osDark?: boolean;
  hillshadeEnabled?: boolean;
  hideStartEnd?: boolean;
  showDetails?: boolean;
}

interface StatBlockProps {
  label: string;
  value: string;
  unit?: React.ReactNode;
  noBorderRight?: boolean;
}

function StatBlock({ label, value, unit, noBorderRight }: StatBlockProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '20px 28px',
      borderRight: noBorderRight ? 'none' : '1px solid rgba(30,72,88,0.6)',
      minWidth: 0,
    }}>
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10,
        fontWeight: 400,
        color: 'rgba(240,248,250,0.5)',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 56,
          fontWeight: 700,
          color: '#F0F8FA',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}>
          {value}
        </span>
        {unit && (
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 16,
            fontWeight: 400,
            color: 'rgba(240,248,250,0.7)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            paddingBottom: 4,
          }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function WallpaperRenderClient({
  activity,
  width,
  height,
  baseMap,
  osDark = false,
  hillshadeEnabled = true,
  hideStartEnd = false,
  showDetails = true,
}: WallpaperRenderClientProps) {
  const { stats } = activity;

  return (
    <div style={{
      position: 'relative',
      width,
      height,
      overflow: 'hidden',
      background: '#070E14',
    }}>
      {/* Full-bleed map */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}>
        <ActivityMap
          activity={activity}
          width={width}
          height={height}
          baseMap={baseMap}
          osDark={osDark}
          hillshadeEnabled={hillshadeEnabled}
          hideStartEnd={hideStartEnd}
          hideDetails={true}
        />
      </div>

      {/* HUD overlay */}
      {showDetails && (
        <div style={{
          position: 'absolute',
          bottom: 60,
          left: 60,
          zIndex: 1000,
          minWidth: 700,
          maxWidth: 1000,
          background: 'rgba(14,40,48,0.88)',
          border: '1px solid rgba(30,72,88,0.85)',
          boxShadow: '0 0 40px rgba(224,112,32,0.15), 0 8px 32px rgba(7,14,20,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          {/* Orange accent stripe */}
          <div style={{
            height: 3,
            background: '#E07020',
            width: '100%',
          }} />

          {/* Header: wordmark + activity name */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            padding: '20px 28px 10px',
          }}>
            <span style={{
              fontFamily: "'Ribeye Marrow', cursive",
              fontSize: 36,
              color: '#E07020',
              letterSpacing: '0.05em',
              lineHeight: 1,
              flexShrink: 0,
            }}>
              plot
            </span>
            <span style={{
              width: 1,
              height: 28,
              background: 'rgba(30,72,88,0.8)',
              alignSelf: 'center',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 22,
              fontWeight: 700,
              color: '#F0F8FA',
              letterSpacing: '0.01em',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {activity.name}
            </span>
          </div>

          {/* Sub-header: type · date */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 28px 16px',
          }}>
            {activity.type && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: '#E07020',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}>
                {activity.type}
              </span>
            )}
            {activity.type && stats.startDate && (
              <span style={{
                fontSize: 11,
                color: 'rgba(240,248,250,0.35)',
                lineHeight: 1,
              }}>·</span>
            )}
            {stats.startDate && (
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                fontWeight: 400,
                color: 'rgba(240,248,250,0.65)',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}>
                {fmtDate(stats.startDate)}
              </span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(30,72,88,0.6)', margin: '0 0' }} />

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <StatBlock
              label="Distance"
              value={fmtKm(stats.distance)}
              unit="km"
            />
            <StatBlock
              label="Elevation"
              value={fmtElev(stats.elevationGain)}
              unit={<><ArrowUp size={16} strokeWidth={2} />m</>}
            />
            <StatBlock
              label="Time"
              value={fmtTime(stats.movingTime)}
            />
            <StatBlock
              label="Pace"
              value={fmtPace(stats.distance, stats.movingTime)}
              unit="/km"
              noBorderRight
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(30,72,88,0.4)', margin: '0 0' }} />

          {/* Footer: attribution */}
          <div style={{
            padding: '8px 28px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: 'rgba(240,248,250,0.22)',
            lineHeight: 1.5,
            letterSpacing: '0.04em',
          }}>
            © Crown copyright · Ordnance Survey
          </div>
        </div>
      )}
    </div>
  );
}
