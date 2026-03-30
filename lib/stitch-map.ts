import sharp from 'sharp';
import proj4 from 'proj4';
import { OS_PROJECTION, type BaseMap } from '@/lib/map-config';
import { type ExportMode } from '@/lib/render-dimensions';

// Register projections once at module load
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
proj4.defs('EPSG:27700', OS_PROJECTION.proj4);

export interface StitchOptions {
  route: [number, number][];
  center: [number, number];
  exportMode: ExportMode;
  baseMap: BaseMap;
  osDark: boolean;
  hillshadeEnabled?: boolean;
  useTopo?: boolean;
  width: number;
  height: number;
  renderZoom: number;
  origin: string;
  bypassSecret?: string;
}

function osLatLngToPixel(lat: number, lng: number, zoom: number): [number, number] {
  const [east, north] = proj4('EPSG:4326', 'EPSG:27700', [lng, lat]);
  const res = OS_PROJECTION.resolutions[zoom];
  return [
    (east - OS_PROJECTION.origin[0]) / res,
    (OS_PROJECTION.origin[1] - north) / res,
  ];
}

function mercatorLatLngToPixel(lat: number, lng: number, zoom: number): [number, number] {
  const n = Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  return [
    ((lng + 180) / 360) * n * 256,
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256,
  ];
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function buildSvg(
  route: [number, number][],
  routePixels: [number, number][],
  routeColor: string,
  outlineColor: string,
  routeOpacity: number,
  arrowOpacity: number,
  width: number,
  height: number,
): string {
  // Filter out any NaN/Infinity pixel values — a single NaN in <polyline points>
  // causes librsvg to silently drop the entire polyline.
  const validPixels = routePixels.map(
    ([x, y]): [number, number] => [isFinite(x) ? x : NaN, isFinite(y) ? y : NaN],
  );
  const pts = validPixels
    .filter(([x, y]) => isFinite(x) && isFinite(y))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  // Sample direction arrows every 2000m, max 20, skip first/last 5%
  const cumDist: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cumDist.push(
      cumDist[i - 1] +
        haversineDistance(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]),
    );
  }
  const arrows: string[] = [];
  if (cumDist[cumDist.length - 1] >= 500) {
    const skip = Math.floor(route.length * 0.05);
    let nextTarget = 2000;
    let count = 0;
    for (let i = skip; i < route.length - skip; i++) {
      if (cumDist[i] >= nextTarget) {
        const ahead = Math.min(i + 5, route.length - 1);
        const deg = bearingDeg(route[i][0], route[i][1], route[ahead][0], route[ahead][1]);
        const [ax, ay] = validPixels[i];
        if (!isFinite(ax) || !isFinite(ay)) { nextTarget += 2000; continue; }
        arrows.push(
          `<g transform="translate(${ax.toFixed(1)},${ay.toFixed(1)}) rotate(${deg.toFixed(1)})">` +
            `<path d="M14,7 L0,-7 L-14,7" fill="none" stroke="${routeColor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="${arrowOpacity}"/>` +
            `</g>`,
        );
        nextTarget += 2000;
        if (++count >= 20) break;
      }
    }
  }

  const firstValid = validPixels.find(([x, y]) => isFinite(x) && isFinite(y)) ?? validPixels[0];
  const lastValid = [...validPixels].reverse().find(([x, y]) => isFinite(x) && isFinite(y)) ?? validPixels[validPixels.length - 1];
  const [sx, sy] = firstValid;
  const [ex, ey] = lastValid;
  // Markers scaled up to be visible at full export resolution (~3× screen)
  const r = 16;

  // All defs at the top so clip-path/filter references are never forward references.
  // The route-outline filter mirrors ActivityMap's feMorphology approach: dilate the
  // alpha channel to produce a border-only outline, then merge it behind the source
  // graphic so the route fill stays at its target opacity (map shows through).
  const defs =
    `<defs>` +
    `<filter id="route-outline" x="-5%" y="-5%" width="110%" height="110%">` +
    `<feComponentTransfer in="SourceAlpha" result="opaque-alpha">` +
    `<feFuncA type="linear" slope="100" intercept="0"/>` +
    `</feComponentTransfer>` +
    `<feMorphology in="opaque-alpha" operator="dilate" radius="5" result="dilated"/>` +
    `<feFlood flood-color="${outlineColor}" flood-opacity="0.9" result="color"/>` +
    `<feComposite in="color" in2="dilated" operator="in" result="full-outline"/>` +
    `<feComposite in="full-outline" in2="opaque-alpha" operator="out" result="border-only"/>` +
    `<feMerge>` +
    `<feMergeNode in="border-only"/>` +
    `<feMergeNode in="SourceGraphic"/>` +
    `</feMerge>` +
    `</filter>` +
    `<clipPath id="end-clip">` +
    `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${r}"/>` +
    `</clipPath>` +
    `</defs>`;

  const startMarker =
    `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r}" ` +
    `fill="${routeColor}" stroke="white" stroke-width="4" opacity="0.85"/>`;

  // Checkerboard end marker (matches ActivityMap)
  const endMarker = [
    `<g clip-path="url(#end-clip)">`,
    `<rect x="${(ex - r).toFixed(1)}" y="${(ey - r).toFixed(1)}" width="${r}" height="${r}" fill="${routeColor}"/>`,
    `<rect x="${ex.toFixed(1)}" y="${(ey - r).toFixed(1)}" width="${r}" height="${r}" fill="white"/>`,
    `<rect x="${(ex - r).toFixed(1)}" y="${ey.toFixed(1)}" width="${r}" height="${r}" fill="white"/>`,
    `<rect x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" width="${r}" height="${r}" fill="${routeColor}"/>`,
    `</g>`,
    `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${r}" fill="none" stroke="white" stroke-width="3.5"/>`,
  ].join('');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    defs,
    // Single polyline with outline filter — matches ActivityMap's feMorphology approach.
    // The filter adds a border-only outline so the fill stays at routeOpacity (map shows through).
    `<polyline points="${pts}" fill="none" stroke="${routeColor}" stroke-width="14" stroke-opacity="${routeOpacity}" stroke-linecap="round" stroke-linejoin="round" filter="url(#route-outline)"/>`,
    ...arrows,
    startMarker,
    endMarker,
    `</svg>`,
  ].join('\n');
}

export async function stitchMapImage(opts: StitchOptions): Promise<Buffer> {
  const { route, center, baseMap, osDark, hillshadeEnabled, useTopo, width, height, renderZoom, origin, bypassSecret } = opts;

  const isSatellite = baseMap === 'satellite';
  const isTopo = useTopo === true && !isSatellite;
  const isDark = isSatellite || osDark;
  const routeColor = isDark ? '#E09B45' : '#4A5A2B';
  const outlineColor = isDark ? '#5A2D00' : '#3A4722';
  // Export needs higher opacity than browser — the 0.35 ActivityMap value
  // reads well at screen res but looks too faint on a large print-resolution image.
  const routeOpacity = isDark ? 0.60 : 0.35;
  const arrowOpacity = isDark ? routeOpacity : 0.85;

  const latLngToPixel = (lat: number, lng: number): [number, number] =>
    (isSatellite || isTopo)
      ? mercatorLatLngToPixel(lat, lng, renderZoom)
      : osLatLngToPixel(lat, lng, renderZoom);

  const [centerPixelX, centerPixelY] = latLngToPixel(center[0], center[1]);
  const topLeftPixelX = centerPixelX - width / 2;
  const topLeftPixelY = centerPixelY - height / 2;

  const tileXMin = Math.floor(topLeftPixelX / 256);
  const tileYMin = Math.floor(topLeftPixelY / 256);
  const tileXMax = Math.floor((topLeftPixelX + width - 1) / 256);
  const tileYMax = Math.floor((topLeftPixelY + height - 1) / 256);

  const offsetX = Math.round(topLeftPixelX - tileXMin * 256);
  const offsetY = Math.round(topLeftPixelY - tileYMin * 256);

  const tilesWide = tileXMax - tileXMin + 1;
  const tilesTall = tileYMax - tileYMin + 1;

  const bypassParam = bypassSecret
    ? `&x-vercel-protection-bypass=${bypassSecret}&x-vercel-set-bypass-cookie=samesitenone`
    : '';

  const getTileUrl = (tx: number, ty: number, z: number): string => {
    if (isSatellite) return `${origin}/api/satellite?z=${z}&x=${tx}&y=${ty}${bypassParam}`;
    if (isTopo) return `${origin}/api/maps/topo?z=${z}&x=${tx}&y=${ty}${osDark ? '&dark=1' : ''}${bypassParam}`;
    return `${origin}${osDark ? '/api/maps/dark' : '/api/maps'}?z=${z}&x=${tx}&y=${ty}${bypassParam}`;
  };

  // Fetch all tiles in parallel; silently skip failed tiles (canvas stays gray)
  const fetchPromises: Promise<{ left: number; top: number; input: Buffer } | null>[] = [];
  for (let ty = tileYMin; ty <= tileYMax; ty++) {
    for (let tx = tileXMin; tx <= tileXMax; tx++) {
      const left = (tx - tileXMin) * 256;
      const top = (ty - tileYMin) * 256;
      fetchPromises.push(
        fetch(getTileUrl(tx, ty, renderZoom))
          .then(async (res) => {
            if (!res.ok) return null;
            return { left, top, input: Buffer.from(await res.arrayBuffer()) };
          })
          .catch(() => null),
      );
    }
  }

  // Append hillshade overlay tiles (RGBA PNG) after OS tiles so Sharp composites them on top.
  // Fetch at 2 zoom levels below renderZoom to reduce tile count by ~16× and avoid timeouts
  // from the large number of external terrarium elevation fetches per tile.
  // Topo (non-GB) uses the EPSG:3857 /api/hillshade endpoint (global coverage);
  // GB uses /api/hillshade27700 (BNG). Both are downscaled by 2 zoom levels to reduce
  // the number of external terrarium fetches per tile.
  if (hillshadeEnabled && !isSatellite) {
    const darkParam = osDark ? '&dark=1' : '';
    const hillshadeEndpoint = isTopo ? 'hillshade' : 'hillshade27700';
    const zoomDiff = 2;
    const hillshadeZoom = Math.max(0, renderZoom - zoomDiff);
    const scaleFactor = 1 << (renderZoom - hillshadeZoom); // 4 when zoomDiff=2
    const tileSizePx = scaleFactor * 256;

    const hsTileXMin = Math.floor(tileXMin / scaleFactor);
    const hsTileXMax = Math.floor(tileXMax / scaleFactor);
    const hsTileYMin = Math.floor(tileYMin / scaleFactor);
    const hsTileYMax = Math.floor(tileYMax / scaleFactor);

    for (let hsTy = hsTileYMin; hsTy <= hsTileYMax; hsTy++) {
      for (let hsTx = hsTileXMin; hsTx <= hsTileXMax; hsTx++) {
        const hsLeft = (hsTx * scaleFactor - tileXMin) * 256;
        const hsTop  = (hsTy * scaleFactor - tileYMin) * 256;

        // Skip tiles entirely outside the canvas
        if (hsLeft + tileSizePx <= 0 || hsTop + tileSizePx <= 0) continue;
        if (hsLeft >= tilesWide * 256   || hsTop >= tilesTall * 256) continue;

        const extractLeft = Math.max(0, -hsLeft);
        const extractTop  = Math.max(0, -hsTop);
        const left = Math.max(0, hsLeft);
        const top  = Math.max(0, hsTop);

        fetchPromises.push(
          fetch(`${origin}/api/${hillshadeEndpoint}?z=${hillshadeZoom}&x=${hsTx}&y=${hsTy}${darkParam}${bypassParam}`)
            .then(async r => {
              if (!r.ok) return null;
              const raw = Buffer.from(await r.arrayBuffer());
              // Scale up to cover the scaleFactor-tile area in the canvas
              let tile: Buffer = await sharp(raw)
                .resize(tileSizePx, tileSizePx, { fit: 'fill', kernel: 'nearest' })
                .toBuffer();
              // Crop off any portion that falls outside the canvas (edge tiles)
              if (extractLeft > 0 || extractTop > 0) {
                tile = await sharp(tile)
                  .extract({
                    left: extractLeft,
                    top:  extractTop,
                    width:  tileSizePx - extractLeft,
                    height: tileSizePx - extractTop,
                  })
                  .toBuffer();
              }
              return { left, top, input: tile };
            })
            .catch(() => null)
        );
      }
    }
  }

  const fetchedTiles = (await Promise.all(fetchPromises)).filter(
    (t): t is NonNullable<typeof t> => t !== null,
  );

  // Composite tiles onto a gray canvas, then crop to exact output dimensions.
  // Use raw pixel buffers for intermediates — PNG encode/decode of a large
  // tilesheet is extremely slow (was the cause of Vercel timeout on large exports).
  const { data: stitchedRaw, info: stitchedInfo } = await sharp({
    create: {
      width: tilesWide * 256,
      height: tilesTall * 256,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .composite(fetchedTiles)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: croppedRaw } = await sharp(stitchedRaw, {
    raw: { width: stitchedInfo.width, height: stitchedInfo.height, channels: stitchedInfo.channels },
  })
    .extract({ left: offsetX, top: offsetY, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const hasRoute = route.length >= 2;
  if (!hasRoute) {
    return sharp(croppedRaw, { raw: { width, height, channels: stitchedInfo.channels } })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // Convert route coordinates to image pixel positions
  const routePixels = route.map(([lat, lng]): [number, number] => {
    const [px, py] = latLngToPixel(lat, lng);
    return [px - topLeftPixelX, py - topLeftPixelY];
  });

  const nanCount = routePixels.filter(([x, y]) => !isFinite(x) || !isFinite(y)).length;
  console.log(
    '[stitch-map] route points:', route.length,
    '| NaN pixels:', nanCount,
    '| dims:', width, 'x', height,
    '| zoom:', renderZoom,
    '| center px:', centerPixelX.toFixed(0), centerPixelY.toFixed(0),
    '| first route px:', routePixels[0]?.[0].toFixed(0), routePixels[0]?.[1].toFixed(0),
  );

  const svgStr = buildSvg(
    route,
    routePixels,
    routeColor,
    outlineColor,
    routeOpacity,
    arrowOpacity,
    width,
    height,
  );

  // Render SVG at ¼ resolution to keep feMorphology fast at large export sizes.
  // feMorphology is O(pixels): at 25MP it takes ~55s; at ¼ scale (~1.6MP) it takes ~3s.
  //
  // IMPORTANT: on SVG input, sharp passes .resize() dimensions directly to librsvg as the
  // render target — it does NOT rasterise first then scale. So we must call .toBuffer()
  // first (which rasterises at the SVG's declared width/height), then resize the bitmap.
  const svgSmallW = Math.round(width / 4);
  const svgSmallH = Math.round(height / 4);
  const svgSmall = svgStr.replace(
    `width="${width}" height="${height}">`,
    `width="${svgSmallW}" height="${svgSmallH}" viewBox="0 0 ${width} ${height}">`,
  );
  const svgRasterized = await sharp(Buffer.from(svgSmall)).toBuffer();
  const svgOverlay = await sharp(svgRasterized)
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .toBuffer();

  return sharp(croppedRaw, { raw: { width, height, channels: stitchedInfo.channels } })
    .composite([{ input: svgOverlay }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
