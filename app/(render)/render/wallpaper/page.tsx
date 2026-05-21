import { getRecentActivityFromBackend } from '@/lib/backend';
import WallpaperRenderClient from './WallpaperRenderClient';
import type { BaseMap } from '@/lib/map-config';

interface WallpaperPageProps {
  searchParams: Promise<{
    minDistance?: string;
    w?: string;
    h?: string;
    baseMap?: string;
    osDark?: string;
    hillshadeEnabled?: string;
    hideStartEnd?: string;
    showDetails?: string;
  }>;
}

export default async function WallpaperPage({ searchParams }: WallpaperPageProps) {
  const {
    minDistance: minDistanceParam,
    w: wParam,
    h: hParam,
    baseMap: baseMapParam,
    osDark: oDarkParam,
    hillshadeEnabled: hillshadeParam,
    hideStartEnd: hideStartEndParam,
    showDetails: showDetailsParam,
  } = await searchParams;

  const minDistance = Math.max(0, parseInt(minDistanceParam || '10000', 10) || 10000);
  const width = parseInt(wParam || '3840', 10) || 3840;
  const height = parseInt(hParam || '2160', 10) || 2160;
  const baseMap: BaseMap = baseMapParam === 'satellite' ? 'satellite' : 'os';
  const osDark = oDarkParam === 'true';
  const hillshadeEnabled = hillshadeParam !== 'false'; // default true
  const hideStartEnd = hideStartEndParam === 'true';
  const showDetails = showDetailsParam !== 'false'; // default true

  let activity;
  try {
    activity = await getRecentActivityFromBackend(minDistance);
  } catch (err) {
    return (
      <div style={{ color: '#F0F8FA', background: '#070E14', padding: 32, fontFamily: 'monospace' }}>
        Failed to load activity: {err instanceof Error ? err.message : String(err)}
      </div>
    );
  }

  return (
    <div style={{ width, height, overflow: 'hidden' }}>
      <WallpaperRenderClient
        activity={activity}
        width={width}
        height={height}
        baseMap={baseMap}
        osDark={osDark}
        hillshadeEnabled={hillshadeEnabled}
        hideStartEnd={hideStartEnd}
        showDetails={showDetails}
      />
    </div>
  );
}
