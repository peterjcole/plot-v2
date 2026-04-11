import { getActivityDetail, MockOrientation } from '@/lib/strava';
import RenderClient from './RenderClient';

interface RenderPageProps {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{
    token?: string;
    photos?: string;
    orientation?: string;
    baseMap?: string;
    osDark?: string;
    photoCount?: string;
    includeLogo?: string;
    hillshadeEnabled?: string;
    showDescription?: string;
    // Legacy params kept for backward compat
    hidePhotos?: string;
    hideDetails?: string;
  }>;
}

export default async function RenderPage({ params, searchParams }: RenderPageProps) {
  const { activityId } = await params;
  const {
    token, photos, orientation, baseMap, osDark: osDarkParam,
    photoCount: photoCountParam,
    includeLogo, hillshadeEnabled: hillshadeEnabledParam,
    showDescription,
  } = await searchParams;

  if (!token && activityId !== 'mock') {
    return <div>Missing access token</div>;
  }

  const mockOptions = activityId === 'mock' ? {
    photos: photos ? parseInt(photos, 10) : undefined,
    orientation: (['landscape', 'portrait', 'mixed'].includes(orientation ?? '') ? orientation : undefined) as MockOrientation | undefined,
  } : undefined;

  const activity = await getActivityDetail(token || '', activityId, mockOptions);
  const photoCount = photoCountParam ? Math.min(parseInt(photoCountParam, 10), 3) : 0;

  return (
    <div style={{ width: 1200, height: 760, overflow: 'hidden' }}>
      <RenderClient
        activity={activity}
        baseMap={baseMap === 'satellite' ? 'satellite' : 'os'}
        osDark={osDarkParam === 'true'}
        photoCount={photoCount}
        includeLogo={includeLogo === 'true'}
        hillshadeEnabled={hillshadeEnabledParam === 'true'}
        showDescription={showDescription === 'true'}
      />
    </div>
  );
}
