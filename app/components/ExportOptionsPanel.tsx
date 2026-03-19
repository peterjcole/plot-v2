'use client';

import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Loader2, Settings } from 'lucide-react';
import Switch from '@/app/components/ui/Switch';
import type { BaseMap } from '@/lib/map-config';
import {
  type ActivityExportPrefs,
  type AspectRatio,
  EXPORT_PREFS_DEFAULTS,
  PREFS_CHANGED_EVENT,
  buildPrintoutUrl,
  dispatchPrefsChanged,
  loadActivityExportPrefs,
  saveActivityExportPrefs,
} from '@/lib/activity-export-prefs';

interface ExportOptionsPanelProps {
  activityId: string;
}

const selectClass =
  'w-full bg-surface-muted border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent';

const rowClass = 'flex items-center justify-between gap-3';
const labelClass = 'text-sm text-text-secondary shrink-0';

export default function ExportOptionsPanel({ activityId }: ExportOptionsPanelProps) {
  const [prefs, setPrefs] = useState<ActivityExportPrefs>(EXPORT_PREFS_DEFAULTS);
  const [systemDark, setSystemDark] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load prefs from localStorage on mount
  useEffect(() => {
    setPrefs(loadActivityExportPrefs());
  }, []);

  // Detect system dark mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync baseMap/osMapMode/osMapFollowSystem/hillshadeEnabled from ActivityViewClient via custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const incoming = (e as CustomEvent<ActivityExportPrefs>).detail;
      setPrefs((prev) => ({
        ...prev,
        baseMap: incoming.baseMap,
        osMapMode: incoming.osMapMode,
        osMapFollowSystem: incoming.osMapFollowSystem,
        hillshadeEnabled: incoming.hillshadeEnabled ?? false,
      }));
    };
    window.addEventListener(PREFS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, handler);
  }, []);

  function updatePrefs(patch: Partial<ActivityExportPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveActivityExportPrefs(next);
    dispatchPrefsChanged(next);
  }

  async function handleDownload() {
    setLoading(true);
    try {
      const url = buildPrintoutUrl(activityId, prefs, systemDark);
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `activity-${activityId}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-primary dark:bg-primary-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark dark:hover:bg-primary"
        >
          <Settings size={15} aria-hidden="true" />
          Export
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-[9999] w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface-raised/95 backdrop-blur-md p-4 shadow-lg"
        >
          <p className="mb-3 text-sm font-semibold text-text-primary">Export options</p>

          <div className="space-y-3">
            <div className={rowClass}>
              <label htmlFor="export-aspect-ratio" className={labelClass}>
                Aspect ratio
              </label>
              <select
                id="export-aspect-ratio"
                value={prefs.aspectRatio}
                onChange={(e) => updatePrefs({ aspectRatio: e.target.value as AspectRatio })}
                className={selectClass}
              >
                <option value="default">Default</option>
                <option value="4:3">4:3</option>
              </select>
            </div>

            <div className={rowClass}>
              <label htmlFor="export-base-map" className={labelClass}>
                Base map
              </label>
              <select
                id="export-base-map"
                value={prefs.baseMap}
                onChange={(e) => updatePrefs({ baseMap: e.target.value as BaseMap })}
                className={selectClass}
              >
                <option value="os">Ordnance Survey</option>
                <option value="satellite">Satellite</option>
              </select>
            </div>

            {prefs.baseMap === 'os' && (
              <div className="space-y-2">
                <div className={rowClass}>
                  <span className="text-xs font-medium text-text-secondary">Dark mode</span>
                  <Switch
                    checked={prefs.osMapMode === 'dark'}
                    onCheckedChange={(checked) => updatePrefs({ osMapMode: checked ? 'dark' : 'light' })}
                    disabled={prefs.osMapFollowSystem}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs.osMapFollowSystem}
                    onChange={(e) => updatePrefs({ osMapFollowSystem: e.target.checked })}
                    className="w-3.5 h-3.5 accent-accent"
                  />
                  <span className="text-xs text-text-secondary">Follow system colour scheme</span>
                </label>
                <div className={rowClass}>
                  <span className="text-xs font-medium text-text-secondary">Hillshading</span>
                  <Switch
                    checked={prefs.hillshadeEnabled}
                    onCheckedChange={(checked) => updatePrefs({ hillshadeEnabled: checked })}
                  />
                </div>
              </div>
            )}

            <div className={rowClass}>
              <span className={labelClass}>Include images</span>
              <Switch
                checked={prefs.includePhotos}
                onCheckedChange={(checked) => updatePrefs({ includePhotos: checked })}
              />
            </div>

            <div className={rowClass}>
              <span className={labelClass}>Activity details</span>
              <Switch
                checked={prefs.includeDetails ?? true}
                onCheckedChange={(checked) => updatePrefs({ includeDetails: checked })}
              />
            </div>

            <div className={rowClass}>
              <span className={labelClass}>Include logo</span>
              <Switch
                checked={prefs.includeLogo}
                onCheckedChange={(checked) => updatePrefs({ includeLogo: checked })}
              />
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading}
              aria-busy={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary dark:bg-primary-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark dark:hover:bg-primary disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span aria-live="polite">{loading ? 'Generating...' : 'Download JPEG'}</span>
            </button>
          </div>

          <Popover.Arrow className="fill-surface-raised" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
