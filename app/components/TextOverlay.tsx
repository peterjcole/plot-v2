'use client';

import { ActivityData } from '@/lib/types';

interface TextOverlayProps {
  activity: ActivityData;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatPace(metersPerSecond: number): string {
  if (metersPerSecond <= 0) return '--:--';
  const secondsPerKm = 1000 / metersPerSecond;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function TextOverlay({ activity }: TextOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(transparent, rgba(8,3,87,0.75))',
        color: 'white',
        padding: '40px 20px 20px',
        zIndex: 1000,
      }}
    >
      <h1
        style={{
          margin: '0 0 8px',
          fontSize: '24px',
          fontWeight: 'bold',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {activity.name}
      </h1>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: '14px',
          opacity: 0.9,
        }}
      >
        {formatDate(activity.stats.startDate)}
      </p>
      <div
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {formatDistance(activity.stats.distance)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Distance</div>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {formatDuration(activity.stats.movingTime)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Time</div>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {formatPace(activity.stats.averageSpeed)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Pace</div>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            {activity.stats.elevationGain} m
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Elevation</div>
        </div>
      </div>
    </div>
  );
}
