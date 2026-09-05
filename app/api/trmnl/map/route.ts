import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivityFromBackend } from '@/lib/backend';
import { stitchMapImage, type RouteStyle } from '@/lib/stitch-map';
import { fitZoomForFrame } from '@/lib/render-dimensions';
import { computeRouteFraming } from '@/lib/route-framing';
import { OS_PROJECTION } from '@/lib/map-config';
import { toEpaperTone, quantiseGreyPng } from '@/lib/epaper-tone';
import { tokensMatch } from '@/lib/timing-safe-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// TRMNL OG (2-bit / 4-grey) route style: thick pure-black line with a
// pure-white casing so it reads clearly against a base map that's been
// tone-mapped to never use pure black itself (see lib/epaper-tone.ts).
// No direction arrows (2000m-spaced chevrons are noise at 800px) and a
// small "simple" endpoint marker instead of the checkerboard finish, which
// isn't legible at this radius.
const TRMNL_ROUTE_STYLE: Partial<RouteStyle> = {
  innerWidth: 7,
  outerWidth: 13,
  routeColor: '#000000',
  outlineColor: '#ffffff',
  opacity: 1,
  arrows: false,
  markers: 'simple',
  markerRadius: 5,
};

interface RenderCache {
  etag: string;
  buffer: Buffer;
}

let lastRender: RenderCache | null = null;

export async function GET(request: NextRequest) {
  const imageToken = process.env.TRMNL_IMAGE_TOKEN;
  if (!imageToken) {
    return NextResponse.json({ error: 'TRMNL endpoint not configured' }, { status: 503 });
  }

  const sp = request.nextUrl.searchParams;
  const provided = sp.get('token') ?? '';
  if (!tokensMatch(provided, imageToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const minDistance = Math.max(0, parseInt(sp.get('minDistance') || '10000', 10) || 10000);
  // Full device resolution — rendered natively at this size, no CSS scaling.
  const width = Math.min(2000, parseInt(sp.get('w') || '800', 10) || 800);
  const height = Math.min(2000, parseInt(sp.get('h') || '480', 10) || 480);
  const levels = sp.get('levels') === '2' ? 2 : 4;
  const hillshadeEnabled = sp.get('hillshade') === '1';

  let activity;
  try {
    activity = await getRecentActivityFromBackend(minDistance);
  } catch (err) {
    console.error('TRMNL map: failed to fetch activity:', err);
    return NextResponse.json({ error: 'Failed to resolve activity' }, { status: 502 });
  }

  if (!activity) {
    return NextResponse.json({ error: 'No matching activity found' }, { status: 404 });
  }

  const etag = `"${activity.id}-${width}x${height}-${levels}-${hillshadeEnabled}"`;
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' },
    });
  }
  if (lastRender?.etag === etag) {
    return new NextResponse(new Uint8Array(lastRender.buffer), {
      headers: {
        'Content-Type': 'image/png',
        ETag: etag,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  }

  try {
    const route = activity.route;
    const baseMap = 'os' as const;
    const { bbox, center, useTopo } = computeRouteFraming(route, baseMap);

    // Clamp to Landranger (z<=7) — Explorer-detail linework quantises to
    // mush at four grey levels and 800px wide.
    const FIT_PADDING = 0.9;
    const renderZoom = fitZoomForFrame({
      width, height, bbox, isSatellite: false, isTopo: useTopo, padding: FIT_PADDING, maxOsZoom: 7,
    });

    // The title_bar is small enough (a thin strip, not a HUD-sized panel
    // like /api/wallpaper's) that it's not worth shifting the frame to
    // dodge it — centering the route reads better than an off-center frame
    // for the sake of a strip that thin. It overlays the map directly (see
    // full.liquid) rather than reserving its own band.
    const avgLatRad = ((bbox.minLat + bbox.maxLat) / 2 * Math.PI) / 180;
    const resAtZoom = useTopo
      ? (40_075_016.686 * Math.cos(avgLatRad)) / (256 * Math.pow(2, renderZoom))
      : (OS_PROJECTION.resolutions[renderZoom] ?? 7);

    // fitZoomForFrame's "contain" fit is bound by whichever axis is
    // proportionally tighter against the frame — the other axis is left
    // with slack. A route bbox is rarely 800:480 shaped: a wide loop, the
    // common case, is width-bound and leaves empty vertical margin even
    // though the frame is rendered at full native resolution. Bumping to
    // the next whole OS zoom level to close that gap overshoots badly —
    // each level is a flat 2x change, enough to crop real route data off
    // the frame edges (tried it). Instead, scale the *already-stitched*
    // image up by the precise amount needed to fill the looser axis, then
    // crop back to size — a continuous zoom the coarse OS zoom levels
    // can't express. Capped so an extreme aspect ratio can't over-crop.
    const widthM = (bbox.maxLng - bbox.minLng) * 111320 * Math.cos(avgLatRad);
    const heightM = (bbox.maxLat - bbox.minLat) * 111320;
    const occupiedW = widthM / resAtZoom;
    const occupiedH = heightM / resAtZoom;
    const FILL_SCALE_CAP = 1.4;
    const fillScale = Math.min(
      FILL_SCALE_CAP,
      Math.max(1, (width * FIT_PADDING) / occupiedW, (height * FIT_PADDING) / occupiedH),
    );

    const origin = request.nextUrl.origin;
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    const t0 = Date.now();
    console.log(`[trmnl-map] ${width}x${height} zoom=${renderZoom} levels=${levels} hillshade=${hillshadeEnabled}`);

    const mapBuffer = await stitchMapImage({
      route,
      center,
      exportMode: 'landranger',
      baseMap,
      osDark: false,
      hillshadeEnabled,
      useTopo,
      width,
      height,
      renderZoom,
      origin,
      bypassSecret,
      outputFormat: 'png',
      routeStyle: TRMNL_ROUTE_STYLE,
      transformBase: (raw, info) => toEpaperTone(raw, info, { levels }),
    });

    let framedBuffer = mapBuffer;
    if (fillScale > 1.01) {
      const scaledW = Math.round(width * fillScale);
      const scaledH = Math.round(height * fillScale);
      framedBuffer = await sharp(mapBuffer)
        .resize(scaledW, scaledH)
        .extract({
          left: Math.round((scaledW - width) / 2),
          top: Math.round((scaledH - height) / 2),
          width,
          height,
        })
        .png()
        .toBuffer();
    }

    // Belt-and-braces: snap any anti-aliased edge pixels — from the SVG
    // route overlay, and now potentially from the fillScale resize above —
    // back onto the exact 4-level palette before shipping.
    const finalBuffer = await quantiseGreyPng(
      await sharp(framedBuffer).greyscale().png().toBuffer(),
      levels,
    );

    console.log(`[trmnl-map] zoom=${renderZoom} fillScale=${fillScale.toFixed(2)} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    lastRender = { etag, buffer: finalBuffer };

    return new NextResponse(new Uint8Array(finalBuffer), {
      headers: {
        'Content-Type': 'image/png',
        ETag: etag,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('TRMNL map render error:', error);
    return NextResponse.json({ error: 'Failed to generate map' }, { status: 500 });
  }
}
