import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivityFromBackend } from '@/lib/backend';
import { fmtKm, fmtElev, fmtTime, fmtPace, fmtDate } from '@/lib/format-stats';
import { tokensMatch } from '@/lib/timing-safe-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * Polling endpoint for the "plot" TRMNL private plugin. Returns the stats
 * for the athlete's most recent long run/ride as merge variables, plus a
 * URL for the tone-mapped e-paper map image (app/api/trmnl/map).
 *
 * See trmnl-plugin/ for the Liquid template that consumes this payload and
 * trmnl-plugin/README.md for how to wire it up as a private plugin.
 */
export async function GET(request: NextRequest) {
  const bearerToken = process.env.TRMNL_BEARER_TOKEN;
  const imageToken = process.env.TRMNL_IMAGE_TOKEN;
  if (!bearerToken || !imageToken) {
    return NextResponse.json({ error: 'TRMNL endpoint not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!tokensMatch(provided, bearerToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const minDistance = Math.max(0, parseInt(sp.get('minDistance') || '10000', 10) || 10000);

  let activity;
  try {
    activity = await getRecentActivityFromBackend(minDistance);
  } catch (err) {
    console.error('TRMNL: failed to fetch activity:', err);
    return NextResponse.json({ error: 'Failed to resolve activity' }, { status: 502 });
  }

  if (!activity) {
    return NextResponse.json({ error: 'No matching activity found' }, { status: 404 });
  }

  const { stats } = activity;
  const origin = request.nextUrl.origin;
  const imageUrl =
    `${origin}/api/trmnl/map?token=${encodeURIComponent(imageToken)}` +
    `&minDistance=${minDistance}&v=${encodeURIComponent(activity.id)}`;

  return NextResponse.json({
    activity_name: activity.name,
    activity_type: activity.type ?? '',
    date: fmtDate(stats.startDate),
    distance: fmtKm(stats.distance),
    elevation: fmtElev(stats.elevationGain),
    duration: fmtTime(stats.movingTime),
    pace: fmtPace(stats.distance, stats.movingTime),
    image_url: imageUrl,
  });
}
