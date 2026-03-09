import { randomUUID } from 'crypto';
import { type BaseMap } from '@/lib/map-config';
import { type ExportMode } from '@/lib/render-dimensions';

export type { ExportMode };

export interface PlannerRenderJob {
  route: [number, number][]; // [lat, lng][], empty if no route
  center: [number, number];  // WGS84 center (always present)
  exportMode: ExportMode;
  baseMap: BaseMap;
  osDark: boolean;
  expiresAt: number;
}

const store = new Map<string, PlannerRenderJob>();

export function storePlannerRenderJob(
  data: Omit<PlannerRenderJob, 'expiresAt'>
): string {
  const token = randomUUID();
  store.set(token, { ...data, expiresAt: Date.now() + 60_000 });
  return token;
}

export function getPlannerRenderJob(token: string): PlannerRenderJob | null {
  const job = store.get(token);
  if (!job) return null;
  if (Date.now() > job.expiresAt) {
    store.delete(token);
    return null;
  }
  return job;
}
