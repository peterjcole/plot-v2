export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/auth';
import { getActivityDetail, refreshTokenIfNeeded } from '@/lib/strava';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let activity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let streams: Record<string, any> | null = null;

  if (id === 'mock') {
    activity = await getActivityDetail('', id);
  } else {
    const session = await getSession();
    if (!session.accessToken) {
      return new Response('Not authenticated', { status: 401 });
    }
    if (await refreshTokenIfNeeded(session)) {
      await session.save();
    }

    activity = await getActivityDetail(session.accessToken, id);

    // Fetch streams for rich GPX data
    try {
      const streamsRes = await fetch(
        `https://www.strava.com/api/v3/activities/${id}/streams?keys=latlng,altitude,time,heartrate,cadence&key_by_type=true`,
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
      if (streamsRes.ok) {
        streams = await streamsRes.json();
      }
    } catch {
      // Fall back to route-only GPX
    }
  }

  const startMs = activity.stats.startDate
    ? new Date(activity.stats.startDate).getTime()
    : null;

  // Build track points from streams (if available) or fall back to activity.route
  let gpxPoints: string;

  if (streams && streams.latlng?.data?.length) {
    const latlng: [number, number][] = streams.latlng.data;
    const altitude: number[] | undefined = streams.altitude?.data;
    const time: number[] | undefined = streams.time?.data;
    const heartrate: number[] | undefined = streams.heartrate?.data;
    const cadence: number[] | undefined = streams.cadence?.data;

    gpxPoints = latlng
      .map(([lat, lng], i) => {
        const eleTag = altitude?.[i] != null ? `\n        <ele>${altitude[i]}</ele>` : '';
        const timeTag =
          time?.[i] != null && startMs != null
            ? `\n        <time>${new Date(startMs + time[i] * 1000).toISOString()}</time>`
            : '';
        const hr = heartrate?.[i];
        const cad = cadence?.[i];
        const extTag =
          hr != null || cad != null
            ? `\n        <extensions>\n          <gpxtpx:TrackPointExtension>${hr != null ? `\n            <gpxtpx:hr>${hr}</gpxtpx:hr>` : ''}${cad != null ? `\n            <gpxtpx:cad>${cad}</gpxtpx:cad>` : ''}\n          </gpxtpx:TrackPointExtension>\n        </extensions>`
            : '';
        return `      <trkpt lat="${lat}" lon="${lng}">${eleTag}${timeTag}${extTag}\n      </trkpt>`;
      })
      .join('\n');
  } else {
    gpxPoints = activity.route
      .map(([lat, lng]) => `      <trkpt lat="${lat}" lon="${lng}">\n      </trkpt>`)
      .join('\n');
  }

  const descTag = activity.description
    ? `\n    <desc>${escapeXml(activity.description)}</desc>`
    : '';
  const timeMetaTag =
    activity.stats.startDate
      ? `\n    <time>${new Date(activity.stats.startDate).toISOString()}</time>`
      : '';

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Plot"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v2">
  <metadata>
    <name>${escapeXml(activity.name)}</name>${descTag}${timeMetaTag}
  </metadata>
  <trk>
    <name>${escapeXml(activity.name)}</name>
    <trkseg>
${gpxPoints}
    </trkseg>
  </trk>
</gpx>`;

  return new Response(gpx, {
    headers: {
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="activity-${id}.gpx"`,
    },
  });
}
