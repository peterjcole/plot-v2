'use client';

import { X } from 'lucide-react';
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

interface ClusterPhotosPopupProps {
  photos: PhotoItem[];
  screenX: number;
  screenY: number;
  onClose: () => void;
  onPhotoSelect: (photo: PhotoItem, screenX: number, screenY: number) => void;
}

export default function ClusterPhotosPopup({ photos, screenX, screenY, onClose, onPhotoSelect }: ClusterPhotosPopupProps) {
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

  const clampedX = Math.min(Math.max(screenX, 140), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 140);
  const clampedY = Math.max(screenY, 8);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photos at this location"
      onKeyDown={handleKeyDown}
      className="fixed z-50 w-64 bg-surface-raised/70 backdrop-blur-md rounded-xl shadow-lg border border-border overflow-hidden"
      style={{
        left: clampedX,
        top: clampedY,
        transform: 'translateX(-50%) translateY(-100%)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-text-secondary">{photos.length} photos here</span>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="overflow-y-auto max-h-64">
        {photos.map((photo) => (
          <button
            key={photo.photoId}
            onClick={() => onPhotoSelect(photo, screenX, screenY)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-surface-muted transition-colors border-b border-border/50 last:border-b-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/proxy?url=${encodeURIComponent(photo.url)}`}
              alt={photo.activityName}
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-primary truncate">{photo.activityName}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {formatDate(photo.activityDate)}
                {photo.activityDistance != null && ` · ${formatDistance(photo.activityDistance)}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
