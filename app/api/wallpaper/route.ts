import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getBrowser } from '@/lib/puppeteer';
import { getRecentActivityId } from '@/lib/backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RenderCache {
  etag: string;
  buffer: Buffer;
  contentType: string;
}

let lastRender: RenderCache | null = null;

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
  const baseMap = sp.get('baseMap') ?? 'os';
  const osDark = sp.get('osDark') === 'true';
  const hillshadeEnabled = sp.get('hillshadeEnabled') !== 'false'; // default true
  const hideStartEnd = sp.get('hideStartEnd') === 'true';
  const showDetails = sp.get('showDetails') !== 'false'; // default true

  // Resolve current activity id (cheap D1 query) — used as ETag seed
  let activityId: string;
  try {
    activityId = await getRecentActivityId(minDistance);
  } catch (err) {
    console.error('Wallpaper: failed to resolve activity id:', err);
    return NextResponse.json({ error: 'Failed to resolve activity' }, { status: 502 });
  }

  if (!activityId) {
    return NextResponse.json({ error: 'No matching activity found' }, { status: 404 });
  }

  // Build ETag from activity id + render params
  const renderParams = `${activityId}-${width}x${height}-${format}-${baseMap}-${osDark}-${hillshadeEnabled}-${hideStartEnd}-${showDetails}`;
  const etag = `"${renderParams}"`;

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
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

  // Render via Puppeteer
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    const origin = request.nextUrl.origin;
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const bypassParam = bypassSecret
      ? `&x-vercel-protection-bypass=${bypassSecret}&x-vercel-set-bypass-cookie=samesitenone`
      : '';

    const renderUrl =
      `${origin}/render/wallpaper` +
      `?minDistance=${minDistance}` +
      `&w=${width}&h=${height}` +
      `&baseMap=${baseMap}` +
      (osDark ? '&osDark=true' : '') +
      (hillshadeEnabled ? '' : '&hillshadeEnabled=false') +
      (hideStartEnd ? '&hideStartEnd=true' : '') +
      (showDetails ? '' : '&showDetails=false') +
      bypassParam;

    await page.goto(renderUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.waitForFunction(
      () => (window as { __MAP_READY__?: boolean }).__MAP_READY__ === true,
      { timeout: 15000 },
    ).catch(() => {
      console.log('Wallpaper: map ready signal timed out, proceeding');
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    const screenshot = await page.screenshot({ type: 'png' });
    await page.close();

    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const buffer = await sharp(Buffer.from(screenshot))
      .toFormat(format, { ...(format === 'jpeg' && { quality: 92 }) })
      .toBuffer();

    lastRender = { etag, buffer, contentType };

    return new NextResponse(new Uint8Array(buffer), {
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
