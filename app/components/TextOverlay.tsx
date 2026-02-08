'use client';

import { useState, useEffect } from 'react';
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
  const [isMobile, setIsMobile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mobile, show minimal info at top or full info when button clicked
  if (isMobile) {
    return (
      <>
        {/* Minimal distance at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to bottom, rgba(255,248,236,0.88) 0%, rgba(255,248,236,0.5) 70%, transparent 100%)',
            color: '#1C1814',
            padding: '12px 16px',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600 }}>
            {formatDistance(activity.stats.distance)}
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: '#4A5A2B',
              color: '#FFF8EC',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {showDetails ? 'Hide Info' : 'More Info'}
          </button>
        </div>

        {/* Full details overlay when button clicked */}
        {showDetails && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to bottom, transparent 0%, rgba(255,248,236,0.5) 40%, rgba(255,248,236,0.88) 100%)',
              color: '#1C1814',
              padding: '60px 16px 20px',
              zIndex: 1000,
            }}
          >
            <h1
              style={{
                margin: '0 0 6px',
                fontSize: '20px',
                fontWeight: 'bold',
                letterSpacing: '-0.01em',
                textShadow: '0 1px 2px rgba(255,248,236,0.6)',
              }}
            >
              {activity.name}
            </h1>
            <p
              style={{
                margin: '0 0 12px',
                fontSize: '12px',
                fontWeight: 400,
              }}
            >
              {formatDate(activity.stats.startDate)}
            </p>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
                  {formatDistance(activity.stats.distance)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 400 }}>Distance</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
                  {formatDuration(activity.stats.movingTime)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 400 }}>Time</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
                  {formatPace(activity.stats.averageSpeed)}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 400 }}>Pace</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
                  {activity.stats.elevationGain} m
                </div>
                <div style={{ fontSize: '12px', fontWeight: 400 }}>Elevation</div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop: show full overlay at bottom (original behavior)
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(255,248,236,0.5) 40%, rgba(255,248,236,0.88) 100%)',
        color: '#1C1814',
        padding: '60px 24px 20px',
        zIndex: 1000,
      }}
    >
      <h1
        style={{
          margin: '0 0 8px',
          fontSize: '24px',
          fontWeight: 'bold',
          letterSpacing: '-0.01em',
          textShadow: '0 1px 2px rgba(255,248,236,0.6)',
        }}
      >
        {activity.name}
      </h1>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: '13px',
          fontWeight: 400,
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
          <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
            {formatDistance(activity.stats.distance)}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 400 }}>Distance</div>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
            {formatDuration(activity.stats.movingTime)}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 400 }}>Time</div>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
            {formatPace(activity.stats.averageSpeed)}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 400 }}>Pace</div>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>
            {activity.stats.elevationGain} m
          </div>
          <div style={{ fontSize: '13px', fontWeight: 400 }}>Elevation</div>
        </div>
      </div>
    </div>
  );
}
