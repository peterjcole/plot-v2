import { NextRequest, NextResponse } from 'next/server';
import { type ExportMode, calculateRenderDimensions, getExportRenderZoom } from '@/lib/render-dimensions';
import { type BaseMap } from '@/lib/map-config';
import { stitchMapImage } from '@/lib/stitch-map';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: {
    route?: unknown;
    center?: unknown;
    exportMode?: unknown;
    baseMap?: unknown;
    osDark?: unknown;
    hillshadeEnabled?: unknown;
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
  const hillshadeEnabled = body.hillshadeEnabled === true;

  const hasRoute = route.length >= 2;

  let width = parseInt(process.env.EXPORT_DEFAULT_WIDTH ?? '7680', 10);
  let height = parseInt(process.env.EXPORT_DEFAULT_HEIGHT ?? '6144', 10);
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
    // Always centre on the route bbox — the viewport center from the client
    // may differ (user panned/zoomed), which would place the route outside the image.
    center = [(bbox.minLat + bbox.maxLat) / 2, (bbox.minLng + bbox.maxLng) / 2];

    const MAX_ROUTE_PIXELS = exportMode === 'satellite'
      ? parseInt(process.env.EXPORT_MAX_PIXELS_SATELLITE ?? '10000000', 10)
      : parseInt(process.env.EXPORT_MAX_PIXELS_OS ?? '25000000', 10);
    const dims = calculateRenderDimensions(bbox, exportMode, MAX_ROUTE_PIXELS);
    width = dims.width;
    height = dims.height;
    renderZoom = dims.renderZoom;
  }

  // Detect routes outside Great Britain — same bounds check as ActivityMap.
  // Outside GB, OS tiles return transparent (server-side clipping), so we switch
  // to EPSG:3857 topo tiles and recompute dimensions in mercator space.
  const GB_BOUNDS = { minLat: 49.8, maxLat: 61.5, minLng: -8.0, maxLng: 2.0 };
  const isGB = baseMap === 'satellite'
    || (center[0] >= GB_BOUNDS.minLat && center[0] <= GB_BOUNDS.maxLat
        && center[1] >= GB_BOUNDS.minLng && center[1] <= GB_BOUNDS.maxLng);
  const useTopo = baseMap === 'os' && !isGB;

  if (useTopo && hasRoute) {
    const lats = route.map(([lat]) => lat);
    const lngs = route.map(([, lng]) => lng);
    const bbox = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
    const avgLat = center[0];
    const avgLatRad = avgLat * Math.PI / 180;
    const circumference = 40_075_016.686;
    const widthM = (bbox.maxLng - bbox.minLng) * 111320 * Math.cos(avgLatRad);
    const heightM = (bbox.maxLat - bbox.minLat) * 111320;
    const MAX_ROUTE_PIXELS = parseInt(process.env.EXPORT_MAX_PIXELS_OS ?? '25000000', 10);
    // Topo tiles go up to z=16; cap at 15 (explorer) / 14 (landranger) for matching detail level
    const topoMaxZoom = exportMode === 'landranger' ? 14 : 15;
    renderZoom = topoMaxZoom;
    while (renderZoom > 0) {
      const res = (circumference * Math.cos(avgLatRad)) / (256 * Math.pow(2, renderZoom));
      const w = Math.max(Math.round((widthM * 1.2) / res), 800);
      const h = Math.max(Math.round((heightM * 1.2) / res), 600);
      if (w * h <= MAX_ROUTE_PIXELS) break;
      renderZoom--;
    }
    const res = (circumference * Math.cos(avgLatRad)) / (256 * Math.pow(2, renderZoom));
    width = Math.max(Math.round((widthM * 1.2) / res), 800);
    height = Math.max(Math.round((heightM * 1.2) / res), 600);
  }

  const origin = request.nextUrl.origin;
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  console.log(`[planner-printout] ${width}x${height}px zoom=${renderZoom} mode=${exportMode} topo=${useTopo} tiles=${Math.ceil(width/256)*Math.ceil(height/256)}`);
  const t0 = Date.now();

  try {
    const jpeg = await stitchMapImage({
      route,
      center,
      exportMode,
      baseMap,
      osDark,
      hillshadeEnabled,
      useTopo,
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
