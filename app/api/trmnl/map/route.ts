import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivityFromBackend } from '@/lib/backend';
import { stitchMapImage, type RouteStyle } from '@/lib/stitch-map';
import { fitZoomForFrame } from '@/lib/render-dimensions';
import { computeRouteFraming } from '@/lib/route-framing';
import { toEpaperTone, quantiseGreyPng } from '@/lib/epaper-tone';
import { tokensMatch } from '@/lib/timing-safe-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// TRMNL OG (2-bit / 4-grey) route style: a hollow pure-black outline (two
// thin casing strokes, transparent middle) so the OS Landranger linework
// underneath — the paths and tracks the route actually followed — stays
// legible through the trace instead of being blotted out by a solid line.
// Pure black is load-bearing: toEpaperTone (lib/epaper-tone.ts) deliberately
// never emits level 0 for the base map, so the hairline casing is the only
// pure-black ink on screen and survives the final quantiseGreyPng snap.
// No direction arrows (2000m-spaced chevrons are noise at 800px) and a
// small "simple" endpoint marker instead of the checkerboard finish, which
// isn't legible at this radius.
// The knocked-out core isn't left fully transparent either — a light dot
// stipple (ordered dither) fills it, sparse enough that the map still shows
// through the gaps but dense enough that the corridor reads as a deliberate
// light background rather than a bare hole.
const DEFAULT_OUTER_WIDTH = 11;
const DEFAULT_CASING = 2;
const DEFAULT_DITHER_SPACING = 5;
const DEFAULT_DITHER_DOT_SIZE = 2;
const TRMNL_ROUTE_STYLE: Partial<RouteStyle> = {
  outerWidth: DEFAULT_OUTER_WIDTH,
  innerWidth: DEFAULT_OUTER_WIDTH - 2 * DEFAULT_CASING,
  routeColor: '#ffffff',
  outlineColor: '#000000',
  opacity: 1,
  arrows: false,
  markers: 'simple',
  markerRadius: 5,
  hollow: true,
  dither: { spacing: DEFAULT_DITHER_SPACING, dotSize: DEFAULT_DITHER_DOT_SIZE },
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

  // Optional line-weight overrides for comparing hollow-outline variants
  // without a rebuild. `lw` is the total footprint, `casing` the thickness
  // of each casing stroke; the transparent gap is whatever's left between
  // them. Clamped so the gap can't go negative or the casing vanish.
  const outerWidth = Math.min(40, Math.max(3, parseFloat(sp.get('lw') || '') || DEFAULT_OUTER_WIDTH));
  const casing = Math.min(outerWidth / 2 - 0.5, Math.max(1, parseFloat(sp.get('casing') || '') || DEFAULT_CASING));
  const innerWidth = outerWidth - 2 * casing;
  // `dither=0` drops back to a fully transparent core; otherwise `spacing`/
  // `dot` tune the stipple that fills it (see DEFAULT_ROUTE_STYLE comment).
  const ditherOn = sp.get('dither') !== '0';
  const ditherSpacing = Math.round(Math.min(20, Math.max(2, parseFloat(sp.get('spacing') || '') || DEFAULT_DITHER_SPACING)));
  const ditherDotSize = Math.round(Math.min(ditherSpacing - 1, Math.max(1, parseFloat(sp.get('dot') || '') || DEFAULT_DITHER_DOT_SIZE)));

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

  const etag = `"${activity.id}-${width}x${height}-${levels}-${hillshadeEnabled}-${outerWidth}-${casing}-${ditherOn ? `${ditherSpacing}x${ditherDotSize}` : 'none'}"`;
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
    //
    // fitZoomForFrame's "contain" fit is bound by whichever axis is
    // proportionally tighter against the frame — the other axis is left
    // with slack (a route bbox is rarely 800:480-shaped, so a wide loop
    // leaves empty vertical margin). A previous version closed that gap by
    // scaling the already-stitched raster up by a continuous factor the
    // coarse OS zoom levels can't express — but that's upscaling tile
    // pixels past their native resolution, which is what was making the
    // map look pixelated on-device. We don't do that: any slack from the
    // "contain" fit is left as margin instead.
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
      routeStyle: {
        ...TRMNL_ROUTE_STYLE,
        outerWidth,
        innerWidth,
        dither: ditherOn ? { spacing: ditherSpacing, dotSize: ditherDotSize } : undefined,
      },
      transformBase: (raw, info) => toEpaperTone(raw, info, { levels }),
    });

    // Belt-and-braces: snap any anti-aliased edge pixels from the SVG route
    // overlay back onto the exact 4-level palette before shipping.
    const finalBuffer = await quantiseGreyPng(
      await sharp(mapBuffer).greyscale().png().toBuffer(),
      levels,
    );

    console.log(`[trmnl-map] zoom=${renderZoom} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

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
