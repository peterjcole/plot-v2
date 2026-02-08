'use client';

import { useState } from 'react';
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
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      {/* Mobile: Minimal distance at top with toggle button */}
      <div
        className="md:hidden absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-3 z-[1000]"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,248,236,0.88) 0%, rgba(255,248,236,0.5) 70%, transparent 100%)',
          color: '#1C1814',
        }}
      >
        <div className="text-sm font-semibold">
          {formatDistance(activity.stats.distance)}
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="px-3 py-1.5 text-[13px] font-medium rounded cursor-pointer border-none"
          style={{
            background: '#4A5A2B',
            color: '#FFF8EC',
          }}
        >
          {showDetails ? 'Hide Info' : 'More Info'}
        </button>
      </div>

      {/* Mobile: Full details overlay when button clicked */}
      <div
        className={`md:hidden absolute bottom-0 left-0 right-0 px-4 pt-[60px] pb-5 z-[1000] ${showDetails ? 'block' : 'hidden'}`}
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,248,236,0.5) 40%, rgba(255,248,236,0.88) 100%)',
          color: '#1C1814',
        }}
      >
        <h1
          className="m-0 mb-1.5 text-[20px] font-bold tracking-tight"
          style={{
            textShadow: '0 1px 2px rgba(255,248,236,0.6)',
          }}
        >
          {activity.name}
        </h1>
        <p className="m-0 mb-3 text-xs">
          {formatDate(activity.stats.startDate)}
        </p>
        <div className="flex gap-4 flex-wrap">
          <div>
            <div className="text-lg font-bold tracking-tight">
              {formatDistance(activity.stats.distance)}
            </div>
            <div className="text-xs">Distance</div>
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">
              {formatDuration(activity.stats.movingTime)}
            </div>
            <div className="text-xs">Time</div>
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">
              {formatPace(activity.stats.averageSpeed)}
            </div>
            <div className="text-xs">Pace</div>
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">
              {activity.stats.elevationGain} m
            </div>
            <div className="text-xs">Elevation</div>
          </div>
        </div>
      </div>

      {/* Desktop: Full overlay at bottom (always visible) */}
      <div
        className="hidden md:block absolute bottom-0 left-0 right-0 px-6 pt-[60px] pb-5 z-[1000]"
        style={{
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,248,236,0.5) 40%, rgba(255,248,236,0.88) 100%)',
          color: '#1C1814',
        }}
      >
        <h1
          className="m-0 mb-2 text-2xl font-bold tracking-tight"
          style={{
            textShadow: '0 1px 2px rgba(255,248,236,0.6)',
          }}
        >
          {activity.name}
        </h1>
        <p className="m-0 mb-3 text-[13px]">
          {formatDate(activity.stats.startDate)}
        </p>
        <div className="flex gap-6 flex-wrap">
          <div>
            <div className="text-xl font-bold tracking-tight">
              {formatDistance(activity.stats.distance)}
            </div>
            <div className="text-[13px]">Distance</div>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">
              {formatDuration(activity.stats.movingTime)}
            </div>
            <div className="text-[13px]">Time</div>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">
              {formatPace(activity.stats.averageSpeed)}
            </div>
            <div className="text-[13px]">Pace</div>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight">
              {activity.stats.elevationGain} m
            </div>
            <div className="text-[13px]">Elevation</div>
          </div>
        </div>
      </div>
    </>
  );
}
