import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivityFromBackend } from '@/lib/backend';
import { stitchMapImage } from '@/lib/stitch-map';
import { fitZoomForFrame } from '@/lib/render-dimensions';
import { buildWallpaperHud } from '@/lib/wallpaper-hud';
import { trimRouteEnds } from '@/lib/route-trim';
import { OS_PROJECTION } from '@/lib/map-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Write a dynamic fonts.conf pointing at the actual fonts dir and set
// FONTCONFIG_FILE so librsvg (via Sharp) finds IBM Plex Mono + Ribeye Marrow.
// The static fonts/fonts.conf hardcodes /var/task/fonts (Lambda path); this
// runtime-generated conf works in both dev and prod by using the resolved path.
const FONTS_DIR = process.env.NODE_ENV === 'development'
  ? path.join(process.cwd(), 'fonts')
  : '/var/task/fonts';
try {
  const conf =
    `<?xml version="1.0"?>\n` +
    `<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n` +
    `<fontconfig>\n` +
    `  <dir>${FONTS_DIR}</dir>\n` +
    `  <cachedir>/tmp/fontconfig-cache</cachedir>\n` +
    `  <config><rescan><int>0</int></rescan></config>\n` +
    `</fontconfig>\n`;
  fs.mkdirSync('/tmp/fontconfig-cache', { recursive: true });
  fs.writeFileSync('/tmp/plotv2-fonts.conf', conf);
  process.env.FONTCONFIG_FILE = '/tmp/plotv2-fonts.conf';
} catch {
  // Non-fatal: fall back to whatever system fonts are available
}

interface RenderCache {
  etag: string;
  buffer: Buffer;
  contentType: string;
}

let lastRender: RenderCache | null = null;

const GB_BOUNDS = { minLat: 49.8, maxLat: 61.5, minLng: -8.0, maxLng: 2.0 };

export async function GET(request: NextRequest) {
  const bearerToken = process.env.WALLPAPER_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json({ error: 'Wallpaper endpoint not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${bearerToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const minDistance = Math.max(0, parseInt(sp.get('minDistance') || '10000', 10) || 10000);
  const format = sp.get('format') === 'jpeg' ? 'jpeg' : 'png';
  const width = parseInt(sp.get('w') || '3840', 10) || 3840;
  const height = parseInt(sp.get('h') || '2160', 10) || 2160;
  const baseMap = sp.get('baseMap') === 'satellite' ? 'satellite' : ('os' as const);
  const osDark = sp.get('osDark') === 'true';
  const hillshadeEnabled = sp.get('hillshadeEnabled') !== 'false'; // default true
  const hideStartEnd = sp.get('hideStartEnd') === 'true';
  const showDetails = sp.get('showDetails') !== 'false'; // default true

  // Fetch full activity in one round-trip (route + stats needed for map + HUD)
  let activity;
  try {
    activity = await getRecentActivityFromBackend(minDistance);
  } catch (err) {
    console.error('Wallpaper: failed to fetch activity:', err);
    return NextResponse.json({ error: 'Failed to resolve activity' }, { status: 502 });
  }

  if (!activity) {
    return NextResponse.json({ error: 'No matching activity found' }, { status: 404 });
  }

  // Build ETag from activity id + render params
  const renderParams = `${activity.id}-${width}x${height}-${format}-${baseMap}-${osDark}-${hillshadeEnabled}-${hideStartEnd}-${showDetails}`;
  const etag = `"${renderParams}"`;

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' },
    });
  }

  // Return cached render if activity + params unchanged (warm instance)
  if (lastRender?.etag === etag) {
    return new NextResponse(new Uint8Array(lastRender.buffer), {
      headers: {
        'Content-Type': lastRender.contentType,
        ETag: etag,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  }

  try {
    const route = activity.route;
    const lats = route.map(([lat]) => lat);
    const lngs = route.map(([, lng]) => lng);
    const bbox = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
    const center: [number, number] = [
      (bbox.minLat + bbox.maxLat) / 2,
      (bbox.minLng + bbox.maxLng) / 2,
    ];

    const isSatellite = baseMap === 'satellite';
    const isGB = isSatellite || (
      center[0] >= GB_BOUNDS.minLat && center[0] <= GB_BOUNDS.maxLat &&
      center[1] >= GB_BOUNDS.minLng && center[1] <= GB_BOUNDS.maxLng
    );
    const useTopo = baseMap === 'os' && !isGB;

    const renderZoom = fitZoomForFrame({ width, height, bbox, isSatellite, isTopo: useTopo, padding: 0.70 });

    // Shift center southward so the route sits in the upper portion of the canvas,
    // keeping the bottom clear for the HUD panel (~320px tall at bottom-left).
    const HUD_CLEAR_PX = 160;
    const latShift = (() => {
      if (isSatellite || useTopo) {
        const circ = 40_075_016.686;
        const res = (circ * Math.cos((center[0] * Math.PI) / 180)) / (256 * Math.pow(2, renderZoom));
        return (HUD_CLEAR_PX * res) / 111320;
      }
      const res = OS_PROJECTION.resolutions[renderZoom] ?? 7;
      return (HUD_CLEAR_PX * res) / 111320;
    })();
    const framedCenter: [number, number] = [center[0] - latShift, center[1]];

    const origin = request.nextUrl.origin;
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    const t0 = Date.now();
    console.log(`[wallpaper] ${width}x${height} zoom=${renderZoom} topo=${useTopo} hillshade=${hillshadeEnabled}`);

    const renderRoute = hideStartEnd ? trimRouteEnds(route, 250) : route;

    // Stitch the base map + route overlay
    const mapBuffer = await stitchMapImage({
      route: renderRoute,
      center: framedCenter,
      exportMode: 'explorer',
      baseMap,
      osDark,
      hillshadeEnabled,
      useTopo,
      width,
      height,
      renderZoom,
      origin,
      bypassSecret,
      outputFormat: 'png', // keep lossless for HUD composite
    });

    // Composite HUD SVG overlay
    let finalBuffer: Buffer;
    if (showDetails) {
      const hudSvg = buildWallpaperHud(activity, width, height);
      const hudOverlay = await sharp(Buffer.from(hudSvg)).toBuffer();
      const composed = await sharp(mapBuffer)
        .composite([{ input: hudOverlay }]);
      finalBuffer = format === 'jpeg'
        ? await composed.jpeg({ quality: 92 }).toBuffer()
        : await composed.png().toBuffer();
    } else {
      finalBuffer = format === 'jpeg'
        ? await sharp(mapBuffer).jpeg({ quality: 92 }).toBuffer()
        : mapBuffer;
    }

    console.log(`[wallpaper] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    lastRender = { etag, buffer: finalBuffer, contentType };

    return new NextResponse(new Uint8Array(finalBuffer), {
      headers: {
        'Content-Type': contentType,
        ETag: etag,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Wallpaper render error:', error);
    return NextResponse.json({ error: 'Failed to generate wallpaper' }, { status: 500 });
  }
}
