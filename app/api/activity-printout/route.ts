import { NextRequest, NextResponse } from 'next/server';
import { getBrowser } from '@/lib/puppeteer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const activityId = searchParams.get('activityId');
  if (!activityId) {
    return NextResponse.json(
      { error: 'activityId is required' },
      { status: 400 }
    );
  }

  const width = Math.min(
    Math.max(parseInt(searchParams.get('width') || '1200', 10), 100),
    4096
  );
  const height = Math.min(
    Math.max(parseInt(searchParams.get('height') || '630', 10), 100),
    4096
  );
  const format = searchParams.get('format') === 'jpeg' ? 'jpeg' : 'png';
  const debug = searchParams.get('debug') === 'true';

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width, height });

    // Capture browser console for debugging
    const pageLogs: string[] = [];
    page.on('console', (msg) => pageLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => pageLogs.push(`[error] ${String(err)}`));

    // Build the URL for the render page
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const bypassParam = bypassSecret ? `&x-vercel-protection-bypass=${bypassSecret}&x-vercel-set-bypass-cookie=samesitenone` : '';
    const renderUrl = `${protocol}://${host}/render/${activityId}?width=${width}&height=${height}${bypassParam}`;

    await page.goto(renderUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for the custom __MAP_READY__ signal
    await page.waitForFunction(
      () => window.__MAP_READY__ === true,
      { timeout: 10000 }
    ).catch(() => {
      // Timeout is acceptable, map might be ready enough
      console.log('Map ready signal timed out, proceeding with screenshot');
    });

    // Small delay for any final rendering
    await new Promise((resolve) => setTimeout(resolve, 300));

    const screenshot = await page.screenshot({
      type: format,
      ...(format === 'jpeg' && { quality: 90 }),
    });

    if (debug) {
      const html = await page.content();
      await page.close();
      return NextResponse.json({ logs: pageLogs, url: renderUrl, html: html.substring(0, 5000) });
    }

    await page.close();

    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

    return new NextResponse(Buffer.from(screenshot), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    return NextResponse.json(
      { error: 'Failed to generate screenshot' },
      { status: 500 }
    );
  }
}
