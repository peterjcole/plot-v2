import { getActivityData } from '@/lib/strava';
import RenderClient from './RenderClient';

interface RenderPageProps {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ width?: string; height?: string }>;
}

export default async function RenderPage({ params, searchParams }: RenderPageProps) {
  const { activityId } = await params;
  const { width: widthParam, height: heightParam } = await searchParams;

  const width = parseInt(widthParam || '1200', 10);
  const height = parseInt(heightParam || '630', 10);

  const activity = await getActivityData(activityId);

  return (
    <div style={{ width, height, overflow: 'hidden' }}>
      <RenderClient activity={activity} width={width} height={height} />
    </div>
  );
}
