import type { BaseMap } from '@/lib/map-config';

export type AspectRatio = 'default' | '4:3';

export interface ActivityExportPrefs {
  baseMap: BaseMap;
  osMapMode: 'light' | 'dark';
  osMapFollowSystem: boolean;
  aspectRatio: AspectRatio;
  includePhotos: boolean;
  includeLogo: boolean;
  hillshadeEnabled: boolean;
}

export const EXPORT_PREFS_DEFAULTS: ActivityExportPrefs = {
  baseMap: 'os',
  osMapMode: 'light',
  osMapFollowSystem: true,
  aspectRatio: 'default',
  includePhotos: true,
  includeLogo: false,
  hillshadeEnabled: false,
};

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  'default': { width: 860, height: 540 },
  '4:3': { width: 800, height: 600 },
};

const STORAGE_KEY = 'plotv2-activity-prefs';

export const PREFS_CHANGED_EVENT = 'plotPrefsChanged';

export function loadActivityExportPrefs(): ActivityExportPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old '16:9' value to 'default'
      if (parsed.aspectRatio === '16:9') parsed.aspectRatio = 'default';
      // Drop any unknown aspectRatio values
      if (!(parsed.aspectRatio in ASPECT_RATIO_DIMENSIONS)) delete parsed.aspectRatio;
      return { ...EXPORT_PREFS_DEFAULTS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...EXPORT_PREFS_DEFAULTS };
}

export function saveActivityExportPrefs(prefs: ActivityExportPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

export function dispatchPrefsChanged(prefs: ActivityExportPrefs): void {
  window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT, { detail: prefs }));
}

export function buildPrintoutUrl(
  activityId: string,
  prefs: ActivityExportPrefs,
  systemDark: boolean,
): string {
  const { width, height } = ASPECT_RATIO_DIMENSIONS[prefs.aspectRatio];
  const osDark =
    prefs.baseMap !== 'satellite' &&
    (prefs.osMapFollowSystem ? systemDark : prefs.osMapMode === 'dark');

  let url = `/api/activity-printout?activityId=${encodeURIComponent(activityId)}&format=jpeg&width=${width}&height=${height}`;
  if (prefs.baseMap === 'satellite') url += '&baseMap=satellite';
  if (osDark) url += '&osDark=true';
  if (!prefs.includePhotos) url += '&hidePhotos=true';
  if (prefs.includeLogo) url += '&includeLogo=true';
  if (prefs.hillshadeEnabled && prefs.baseMap !== 'satellite') url += '&hillshadeEnabled=true';
  return url;
}
