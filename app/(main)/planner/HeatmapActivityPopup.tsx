'use client';

import { X, Loader2, ExternalLink } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { HeatmapActivity } from '@/lib/types';
import { getSportColor } from '@/lib/sport-colors';

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
  onHoverActivity: (route: [number, number][] | null, color?: string) => void;
}

export default function HeatmapActivityPopup({
  activities,
  screenX,
  screenY,
  isLoading,
  onClose,
  onHoverActivity,
}: HeatmapActivityPopupProps) {
  const [selectedId, setSelectedId] = useState<number | null>(() =>
    activities.length > 0 ? activities[0].id : null
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button on mount
  useEffect(() => { closeButtonRef.current?.focus(); }, []);

  // Highlight the first activity once activities are populated
  // (popup opens with activities:[] while the fetch is in flight)
  const didHighlightRef = useRef(false);
  useEffect(() => {
    if (!didHighlightRef.current && activities.length > 0) {
      didHighlightRef.current = true;
      onHoverActivity(activities[0].route, getSportColor(activities[0].sportType));
    }
  }, [activities, onHoverActivity]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;

    // Only the selected radio (tabIndex=0) is in the tab order; others are tabIndex=-1
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input[type="radio"][tabindex="0"], a[href]'
      ) ?? []
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function handleRadioKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    let next: HeatmapActivity | undefined;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      next = activities[(index + 1) % activities.length];
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      next = activities[(index - 1 + activities.length) % activities.length];
    }
    if (!next) return;
    e.preventDefault();
    setSelectedId(next.id);
    onHoverActivity(next.route, getSportColor(next.sportType));
    document.getElementById(`activity-radio-${next.id}`)?.focus();
  }

  const clampedX = Math.min(Math.max(screenX, 120), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 120);
  const clampedY = Math.max(screenY, 8);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="heatmap-popup-title"
      onKeyDown={handleKeyDown}
      className="fixed z-50 w-56 bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border"
      style={{
        left: clampedX,
        top: clampedY,
        transform: 'translateX(-50%) translateY(-100%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span
          id="heatmap-popup-title"
          className="text-xs font-semibold text-text-secondary uppercase tracking-wide"
        >
          {isLoading
            ? 'Loading…'
            : activities.length === 0
            ? 'No activities'
            : `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`}
        </span>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div role="status" aria-label="Loading activities" className="flex items-center justify-center py-4">
          <Loader2 size={16} className="animate-spin text-text-secondary" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-text-secondary px-3 py-3">No activities found here.</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-start gap-2 px-3 py-2 hover:bg-surface-muted transition-colors">
              <input
                type="radio"
                name="activity"
                id={`activity-radio-${activity.id}`}
                aria-labelledby={`activity-name-${activity.id}`}
                checked={selectedId === activity.id}
                tabIndex={selectedId === activity.id ? 0 : -1}
                onChange={() => {
                  setSelectedId(activity.id);
                  onHoverActivity(activity.route, getSportColor(activity.sportType));
                }}
                onKeyDown={(e) => handleRadioKeyDown(e, activities.indexOf(activity))}
                className="mt-0.5 shrink-0 accent-accent"
              />
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: getSportColor(activity.sportType) }}
              />
              <label htmlFor={`activity-radio-${activity.id}`} className="min-w-0 flex-1 cursor-pointer">
                <p id={`activity-name-${activity.id}`} className="text-xs font-medium text-text-primary truncate">
                  {activity.name}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatDate(activity.startDate)}
                  {activity.distance != null && ` · ${formatDistance(activity.distance)}`}
                </p>
              </label>
              <a
                href={`/?activity=${activity.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors mt-0.5"
                onClick={e => e.stopPropagation()}
                aria-label={`Open ${activity.name} in new tab`}
              >
                <ExternalLink size={13} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
