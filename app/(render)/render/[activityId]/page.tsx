import { getActivityDetail, MockOrientation } from '@/lib/strava';
import RenderClient from './RenderClient';

interface RenderPageProps {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ width?: string; height?: string; fixed?: string; token?: string; photos?: string; orientation?: string }>;
}

export default async function RenderPage({ params, searchParams }: RenderPageProps) {
  const { activityId } = await params;
  const { width: widthParam, height: heightParam, fixed, token, photos, orientation } = await searchParams;

  const useFixedSize = fixed === 'true';
  const fixedWidth = useFixedSize ? parseInt(widthParam || '860', 10) : undefined;
  const fixedHeight = useFixedSize ? parseInt(heightParam || '540', 10) : undefined;

  if (!token && activityId !== 'mock') {
    return <div>Missing access token</div>;
  }

  const mockOptions = activityId === 'mock' ? {
    photos: photos ? parseInt(photos, 10) : undefined,
    orientation: (['landscape', 'portrait', 'mixed'].includes(orientation ?? '') ? orientation : undefined) as MockOrientation | undefined,
  } : undefined;

  // token is now a JWT (passed from activity-printout route via session)
  const activity = await getActivityDetail(token || '', activityId, mockOptions);

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
