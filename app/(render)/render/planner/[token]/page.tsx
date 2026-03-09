import { notFound } from 'next/navigation';
import { type BaseMap } from '@/lib/map-config';
import { type ExportMode } from '@/lib/render-dimensions';
import PlannerRenderClient from './PlannerRenderClient';

interface PlannerRenderPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ renderZoom?: string }>;
}

interface PlannerJob {
  route: [number, number][];
  center: [number, number];
  exportMode: ExportMode;
  baseMap: BaseMap;
  osDark: boolean;
}

export default async function PlannerRenderPage({
  params,
  searchParams,
}: PlannerRenderPageProps) {
  const { token } = await params;
  const { renderZoom: renderZoomParam } = await searchParams;

  let job: PlannerJob;
  try {
    job = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8')) as PlannerJob;
  } catch {
    return notFound();
  }

  if (!job?.center) return notFound();

  const renderZoom = parseInt(renderZoomParam ?? '9', 10);

  // Compute bbox center from route, or fall back to job.center
  let bboxCenter: [number, number] = job.center;
  if (job.route.length >= 2) {
    const lats = job.route.map(([lat]) => lat);
    const lngs = job.route.map(([, lng]) => lng);
    bboxCenter = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    ];
  }

  return (
    <PlannerRenderClient
      job={job}
      bboxCenter={bboxCenter}
      renderZoom={renderZoom}
    />
  );
}
