import { getActivityDetail } from '@/lib/strava';
import RenderClient from './RenderClient';

interface RenderPageProps {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ width?: string; height?: string; token?: string }>;
}

export default async function RenderPage({ params, searchParams }: RenderPageProps) {
  const { activityId } = await params;
  const { width: widthParam, height: heightParam, token } = await searchParams;

  const width = parseInt(widthParam || '1200', 10);
  const height = parseInt(heightParam || '630', 10);

  if (!token && !activityId.startsWith('mock-')) {
    return <div>Missing access token</div>;
  }

  const activity = await getActivityDetail(token || '', activityId);

  return (
    <div style={{ width, height, overflow: 'hidden' }}>
      <RenderClient activity={activity} width={width} height={height} />
    </div>
  );
}
