import { getActivityDetail } from '@/lib/strava';
import RenderClient from './RenderClient';

interface RenderPageProps {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ width?: string; height?: string; fixed?: string; token?: string }>;
}

export default async function RenderPage({ params, searchParams }: RenderPageProps) {
  const { activityId } = await params;
  const { width: widthParam, height: heightParam, fixed, token } = await searchParams;

  const useFixedSize = fixed === 'true';
  const fixedWidth = useFixedSize ? parseInt(widthParam || '1720', 10) : undefined;
  const fixedHeight = useFixedSize ? parseInt(heightParam || '1080', 10) : undefined;

  if (!token && !activityId.startsWith('mock-')) {
    return <div>Missing access token</div>;
  }

  const activity = await getActivityDetail(token || '', activityId);

  return (
    <div style={{
      width: fixedWidth ?? '100vw',
      height: fixedHeight ?? '100vh',
      overflow: 'hidden',
    }}>
      <RenderClient activity={activity} width={fixedWidth} height={fixedHeight} />
    </div>
  );
}
