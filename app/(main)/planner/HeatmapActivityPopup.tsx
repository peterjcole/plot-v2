'use client';

import { X, Loader2 } from 'lucide-react';
import type { HeatmapActivity } from '@/lib/types';

const SPORT_COLORS: Record<string, string> = {
  Run: 'bg-orange-500',
  TrailRun: 'bg-orange-600',
  Ride: 'bg-blue-500',
  GravelRide: 'bg-blue-600',
  MountainBikeRide: 'bg-green-600',
  VirtualRide: 'bg-blue-400',
  Walk: 'bg-teal-500',
  Hike: 'bg-teal-600',
  Swim: 'bg-cyan-500',
  AlpineSki: 'bg-sky-400',
  NordicSki: 'bg-sky-500',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = 'numeric';
  }
  return d.toLocaleDateString('en-GB', opts);
}

function formatDistance(meters: number | null): string {
  if (meters == null) return '';
  return (meters / 1000).toFixed(1) + ' km';
}

interface HeatmapActivityPopupProps {
  activities: HeatmapActivity[];
  screenX: number;
  screenY: number;
  isLoading: boolean;
  onClose: () => void;
  onHoverActivity: (route: [number, number][] | null) => void;
}

export default function HeatmapActivityPopup({
  activities,
  screenX,
  screenY,
  isLoading,
  onClose,
  onHoverActivity,
}: HeatmapActivityPopupProps) {
  const clampedX = Math.min(Math.max(screenX, 120), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 120);
  const clampedY = Math.max(screenY, 8);

  return (
    <div
      className="fixed z-50 w-56 bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border"
      style={{
        left: clampedX,
        top: clampedY,
        transform: 'translateX(-50%) translateY(-100%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {isLoading
            ? 'Loading…'
            : activities.length === 0
            ? 'No activities'
            : `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`}
        </span>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-text-secondary" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-text-secondary px-3 py-3">No activities found here.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {activities.map((activity) => (
            <li key={activity.id}>
              <a
                href={`/activity/${activity.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 px-3 py-2 hover:bg-surface-muted transition-colors"
                onMouseEnter={() => onHoverActivity(activity.route)}
                onMouseLeave={() => onHoverActivity(null)}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${SPORT_COLORS[activity.sportType ?? ''] ?? 'bg-gray-400'}`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{activity.name}</p>
                  <p className="text-xs text-text-secondary">
                    {formatDate(activity.startDate)}
                    {activity.distance != null && ` · ${formatDistance(activity.distance)}`}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
