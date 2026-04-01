'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { PhotoItem } from '@/lib/types';

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

interface PhotoPopupProps {
  photo: PhotoItem;
  screenX: number;
  screenY: number;
  onClose: () => void;
}

export default function PhotoPopup({ photo, screenX, screenY, onClose }: PhotoPopupProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  const clampedX = Math.min(Math.max(screenX, 120), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 120);
  const clampedY = Math.max(screenY, 8);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo from ${photo.activityName}`}
      onKeyDown={handleKeyDown}
      className="fixed z-50 w-56 bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border overflow-hidden"
      style={{
        left: clampedX,
        top: clampedY,
        transform: 'translateX(-50%) translateY(-100%)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.activityName}
        className="w-full aspect-square object-cover"
      />

      <div className="px-3 py-2">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-medium text-text-primary truncate flex-1">{photo.activityName}</p>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="shrink-0 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-text-secondary mt-0.5">
          {formatDate(photo.activityDate)}
          {photo.activityDistance != null && ` · ${formatDistance(photo.activityDistance)}`}
        </p>
        <div className="mt-2">
          <Link
            href={`/activity/${photo.activityId}`}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Open activity →
          </Link>
        </div>
      </div>
    </div>
  );
}
