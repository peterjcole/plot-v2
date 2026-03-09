import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { type ExportMode, calculateRenderDimensions, getExportRenderZoom } from '@/lib/render-dimensions';
import { type BaseMap } from '@/lib/map-config';
import { stitchMapImage } from '@/lib/stitch-map';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session.accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: {
    route?: unknown;
    center?: unknown;
    exportMode?: unknown;
    baseMap?: unknown;
    osDark?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const route = Array.isArray(body.route) ? (body.route as [number, number][]) : [];
  let center: [number, number] = Array.isArray(body.center)
    ? (body.center as [number, number])
    : [54.4, -2.9];
  const exportMode: ExportMode =
    body.exportMode === 'landranger' ? 'landranger' :
    body.exportMode === 'satellite'  ? 'satellite'  :
    'explorer';
  const baseMap: BaseMap = body.baseMap === 'satellite' ? 'satellite' : 'os';
  const osDark = body.osDark === true;

  const hasRoute = route.length >= 2;

  let width = 5120;
  let height = 2880;
  let renderZoom = getExportRenderZoom(exportMode);

  if (hasRoute) {
    const lats = route.map(([lat]) => lat);
    const lngs = route.map(([, lng]) => lng);
    const bbox = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
    const MAX_ROUTE_PIXELS = exportMode === 'satellite' ? 10_000_000 : 25_000_000;
    const dims = calculateRenderDimensions(bbox, exportMode, MAX_ROUTE_PIXELS);
    width = dims.width;
    height = dims.height;
    renderZoom = dims.renderZoom;
    // Always centre on the route bbox — the viewport center from the client
    // may differ (user panned/zoomed), which would place the route outside the image.
    center = [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLng + bbox.maxLng) / 2];
  }

  const origin = request.nextUrl.origin;
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  console.log(`[planner-printout] ${width}x${height}px zoom=${renderZoom} mode=${exportMode} tiles=${Math.ceil(width/256)*Math.ceil(height/256)}`);
  const t0 = Date.now();

  try {
    const jpeg = await stitchMapImage({
      route,
      center,
      exportMode,
      baseMap,
      osDark,
      width,
      height,
      renderZoom,
      origin,
      bypassSecret,
    });

    console.log(`[planner-printout] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return new NextResponse(new Uint8Array(jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'attachment; filename="route.jpg"',
      },
    });
  } catch (error) {
    console.error('Planner export error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
