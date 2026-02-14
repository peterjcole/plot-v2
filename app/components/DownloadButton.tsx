'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface DownloadButtonProps {
  activityId: string;
}

export default function DownloadButton({ activityId }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/activity-printout?activityId=${encodeURIComponent(activityId)}&format=jpeg`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-${activityId}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      aria-busy={loading}
      className="inline-flex items-center gap-2 rounded-md bg-primary dark:bg-primary-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark dark:hover:bg-primary disabled:opacity-60"
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      <span aria-live="polite">
        {loading ? 'Generating...' : 'Download JPEG'}
      </span>
    </button>
  );
}
