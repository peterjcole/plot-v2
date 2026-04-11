'use client';

import dynamic from 'next/dynamic';
import { ActivityData } from '@/lib/types';
import { type BaseMap } from '@/lib/map-config';

const ActivityMap = dynamic(() => import('@/app/components/ActivityMap'), { ssr: false });

// Photo column layout table (from mockup-export.html)
interface PhotoLayout {
  mapWidth: number;    // px
  photoColWidth: number; // px
  isLandscape?: boolean;
}

function getPhotoLayout(photoCount: number, firstIsLandscape: boolean): PhotoLayout | null {
  if (photoCount === 0) return null;
  if (photoCount === 1 && firstIsLandscape) return { mapWidth: 700, photoColWidth: 500, isLandscape: true };
  if (photoCount === 1) return { mapWidth: 720, photoColWidth: 480 };
  if (photoCount === 2) return { mapWidth: 680, photoColWidth: 520 };
  return { mapWidth: 640, photoColWidth: 560 };
}

// Stats formatting
function fmtKm(m: number): string { return (m / 1000).toFixed(2); }
function fmtElev(m: number): string { return String(Math.round(m)); }
function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
function fmtPace(distM: number, timeSec: number): string {
  if (!distM) return '—';
  const secsPerKm = timeSec / (distM / 1000);
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface StatCellProps { label: string; value: string; unit?: string; isDark: boolean }
function StatCell({ label, value, unit, isDark }: StatCellProps) {
  const dimColor = isDark ? 'rgba(240,248,250,0.34)' : 'rgba(7,54,66,0.38)';
  const valColor = isDark ? '#F0F8FA' : '#073642';
  const unitColor = isDark ? 'rgba(240,248,250,0.44)' : 'rgba(7,54,66,0.44)';
  return (
    <div style={{ padding: '0 18px' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, fontWeight: 400, color: dimColor, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 40, fontWeight: 700, color: valColor, letterSpacing: '0.01em', lineHeight: 1 }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 15, fontWeight: 400, color: unitColor }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function StripDivider({ isDark }: { isDark: boolean }) {
  return (
    <div style={{
      width: 1, alignSelf: 'stretch', margin: '16px 0', flexShrink: 0,
      background: isDark ? 'rgba(30,72,88,0.52)' : 'rgba(189,174,132,0.65)',
    }} />
  );
}

interface ElevSparklineProps { data: { ele: number; distance: number }[]; isDark: boolean }
function ElevSparkline({ data, isDark }: ElevSparklineProps) {
  if (data.length < 2) return null;
  const eles = data.map(p => p.ele);
  const minE = Math.min(...eles);
  const maxE = Math.max(...eles);
  const rangeE = maxE - minE || 1;
  const totalD = data[data.length - 1].distance || 1;
  const W = 160, H = 36;
  const toX = (d: number) => (d / totalD) * W;
  const toY = (e: number) => H - 2 - ((e - minE) / rangeE) * (H - 4);
  const pts = data.map(p => `${toX(p.distance).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ');
  const fill = `M0,${H} L${pts.split(' ').join(' L')} L${W},${H} Z`;
  const gradId = `eg-${isDark ? 'd' : 'l'}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E07020" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#E07020" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke="#E07020" strokeWidth="1.5" strokeOpacity="0.72" />
    </svg>
  );
}

interface RenderClientProps {
  activity: ActivityData;
  baseMap?: BaseMap;
  osDark?: boolean;
  photoCount?: number;
  includeLogo?: boolean;
  hillshadeEnabled?: boolean;
  hideDetails?: boolean;
  showDescription?: boolean;
}

export default function RenderClient({
  activity,
  baseMap,
  osDark = false,
  photoCount: photoCountParam = 0,
  includeLogo,
  hillshadeEnabled,
  showDescription = false,
}: RenderClientProps) {
  const TOTAL_W = 1200;
  const TOTAL_H = 760;
  const STRIP_H = 112;
  const MAP_H = TOTAL_H - STRIP_H; // 648

  const isDark = osDark;

  // Determine photos to show
  const photosToShow = activity.photos.slice(0, Math.min(photoCountParam, 3));
  const actualPhotoCount = photosToShow.length;

  // Detect first photo orientation from width/height metadata; default to landscape if unknown
  const firstPhoto = photosToShow[0];
  const firstIsLandscape = firstPhoto?.width && firstPhoto?.height
    ? firstPhoto.width >= firstPhoto.height
    : true; // default landscape
  const layout = getPhotoLayout(actualPhotoCount, firstIsLandscape);

  const mapW = layout ? layout.mapWidth : TOTAL_W;
  const photoColW = layout ? layout.photoColWidth : 0;

  const { stats } = activity;

  // Watermark position: just left of photo column (or right edge if no photos)
  const wmarkRight = photoColW + 24;

  const bgColor = isDark ? '#070E14' : '#DDD8C4';
  const photoColBg = isDark ? '#070E14' : '#DDD8C4';
  const photoColBorder = isDark ? 'rgba(30,72,88,0.55)' : 'rgba(189,174,132,0.55)';
  const stripBg = isDark ? 'rgba(7,14,20,0.97)' : 'rgba(238,232,213,0.98)';
  const stripBorder = isDark ? 'rgba(30,72,88,0.68)' : 'rgba(189,174,132,0.68)';
  const nameColor = isDark ? '#F0F8FA' : '#073642';
  const dimColor = isDark ? 'rgba(240,248,250,0.44)' : 'rgba(7,54,66,0.44)';
  const dotColor = isDark ? 'rgba(240,248,250,0.22)' : 'rgba(7,54,66,0.22)';
  const attribColor = isDark ? 'rgba(240,248,250,0.16)' : 'rgba(7,54,66,0.18)';

  return (
    <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H, background: bgColor, overflow: 'hidden' }}>

      {/* Map area */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: mapW, height: MAP_H, overflow: 'hidden' }}>
        <ActivityMap
          activity={activity}
          width={mapW}
          height={MAP_H}
          baseMap={baseMap}
          osDark={osDark}
          hillshadeEnabled={hillshadeEnabled}
          hideDetails={true}
        />
      </div>

      {/* Photo column */}
      {layout && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: photoColW, height: MAP_H,
          background: photoColBg,
          borderLeft: `1px solid ${photoColBorder}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {layout.isLandscape ? (
            // Single landscape: fill bands top and bottom
            <>
              <div style={{ flex: '137px 0 0', background: photoColBg }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photosToShow[0].url}
                alt={photosToShow[0].caption ?? 'Activity photo'}
                style={{ width: '100%', height: 375, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1, background: photoColBg }} />
            </>
          ) : (
            // 1 portrait, 2, or 3 photos: stacked equal height with 4px gap
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: '100%' }}>
              {photosToShow.map((photo, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption ?? `Activity photo ${i + 1}`}
                  style={{ flex: 1, width: '100%', objectFit: 'cover', minHeight: 0 }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Watermark */}
      {includeLogo && (
        <div style={{
          position: 'absolute', top: 20, right: wmarkRight,
          fontFamily: 'var(--display)', fontSize: 20, letterSpacing: '0.12em', lineHeight: 1,
          color: isDark ? 'rgba(240,248,250,0.13)' : 'rgba(7,54,66,0.10)',
          pointerEvents: 'none',
        }}>
          plot
        </div>
      )}

      {/* Stats strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: STRIP_H,
        background: stripBg,
        borderTop: `1px solid ${stripBorder}`,
        display: 'flex', alignItems: 'center',
        padding: '0 22px 0 20px',
      }}>
        {/* Wordmark block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexShrink: 0, paddingRight: 20 }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 30, color: '#E07020', letterSpacing: '0.05em', lineHeight: 1 }}>
            plot
          </span>
          <div style={{ maxWidth: 440, overflow: 'hidden' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 19, fontWeight: 700, color: nameColor, letterSpacing: '0.02em', lineHeight: 1.2 }}>
              {activity.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
              {activity.type && (
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 700, color: '#E07020', letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: 1 }}>
                  {activity.type}
                </span>
              )}
              {activity.type && stats.startDate && (
                <span style={{ fontSize: 12, color: dotColor, lineHeight: 1 }}>·</span>
              )}
              {stats.startDate && (
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, fontWeight: 400, color: dimColor, letterSpacing: '0.04em', lineHeight: 1 }}>
                  {fmtDate(stats.startDate)}
                </span>
              )}
            </div>
            {showDescription && activity.description && (
              <div style={{
                fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontStyle: 'italic',
                fontWeight: 400, color: dimColor, letterSpacing: '0.02em', lineHeight: 1.4,
                marginTop: 6, overflow: 'hidden', maxHeight: '2.8em',
              }}>
                {activity.description}
              </div>
            )}
          </div>
        </div>

        <StripDivider isDark={isDark} />

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '0 8px' }}>
          <StatCell label="Distance" value={fmtKm(stats.distance)} unit="km" isDark={isDark} />
          <StripDivider isDark={isDark} />
          <StatCell label="Elevation" value={fmtElev(stats.elevationGain)} unit="m↑" isDark={isDark} />
          <StripDivider isDark={isDark} />
          <StatCell label="Time" value={fmtTime(stats.movingTime)} isDark={isDark} />
          <StripDivider isDark={isDark} />
          <StatCell label="Pace" value={fmtPace(stats.distance, stats.movingTime)} unit="/km" isDark={isDark} />
        </div>

        {/* Attribution */}
        <div style={{ marginLeft: 18, fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, lineHeight: 1.5, color: attribColor, flexShrink: 0, textAlign: 'right' }}>
          © Crown copyright<br />Ordnance Survey
        </div>
      </div>
    </div>
  );
}
