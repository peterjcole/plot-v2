import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import boundaries from '@/lib/country-boundaries.json';

// ── Transparent tile ─────────────────────────────────────────────────────────

let _transparent: Buffer | null = null;
async function getTransparentTile(): Promise<Buffer> {
  if (!_transparent) {
    _transparent = await sharp({
      create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
  }
  return _transparent;
}

// ── Colour processing (same formula as /api/maps/dark) ─────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

async function applyDarkMode(buffer: ArrayBuffer): Promise<Buffer> {
  const { data, info } = await sharp(Buffer.from(buffer))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  for (let i = 0; i < data.length; i += channels) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const lNew = Math.min(0.88, 1 - Math.pow(l, 0.8));
    const sNew = Math.min(1, s * 1.2);
    const [rNew, gNew, bNew] = hslToRgb(h, sNew, lNew);
    data[i] = rNew;
    data[i + 1] = gNew;
    data[i + 2] = bNew;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

// ── Tile math ───────────────────────────────────────────────────────────────

function tileCenterLatLng(z: number, x: number, y: number): [number, number] {
  const n = Math.PI - (2 * Math.PI * (y + 0.5)) / (1 << z);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  const lng = ((x + 0.5) / (1 << z)) * 360 - 180;
  return [lat, lng];
}

// ── Country detection (PiP against Natural Earth 1:50m) ─────────────────────

function getCountry(lat: number, lng: number): string | null {
  const pt = point([lng, lat]);
  for (const feature of (boundaries as GeoJSON.FeatureCollection).features) {
    if (booleanPointInPolygon(pt, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
      return (feature.properties as { ISO_A3: string }).ISO_A3;
    }
  }
  return null;
}

// ── Provider tile fetch ──────────────────────────────────────────────────────

async function fetchTile(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url);
    if (res.ok) return res;
    return null;
  } catch {
    return null;
  }
}

async function getProviderTile(
  iso: string | null,
  z: number,
  x: number,
  y: number
): Promise<{ res: Response; contentType: string } | null> {
  const osKey = process.env.OS_MAPS_API_KEY;
  const geopfKey = process.env.GEOPF_API_KEY;
  const tfKey = process.env.THUNDERFOREST_API_KEY;

  let res: Response | null = null;
  let contentType = 'image/png';

  switch (iso) {
    case 'GBR':
      if (osKey) {
        res = await fetchTile(
          `https://api.os.uk/maps/raster/v1/zxy/Leisure_3857/${z}/${x}/${y}.png?key=${osKey}`
        );
      }
      break;

    case 'FRA': {
      // Step 1: SCAN 25 (requires key)
      if (geopfKey) {
        res = await fetchTile(
          `https://data.geopf.fr/private/wmts?apikey=${geopfKey}&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`
        );
        if (res) { contentType = 'image/jpeg'; break; }
      }
      // Step 2: Plan IGN v2 (no key)
      res = await fetchTile(
        `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`
      );
      break;
    }

    case 'ESP': {
      res = await fetchTile(
        `https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix=${z}&TileCol=${x}&TileRow=${y}`
      );
      if (res) contentType = 'image/jpeg';
      break;
    }

    case 'DEU':
      res = await fetchTile(
        `https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/${z}/${y}/${x}.png`
      );
      break;

    case 'NLD':
      res = await fetchTile(
        `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/${z}/${x}/${y}.png`
      );
      break;

    case 'AUT':
      if (z >= 5) {
        res = await fetchTile(`https://maps.bev.gv.at/tiles/karte/${z}/${x}/${y}.png`);
      }
      break;

    case 'CHE': {
      res = await fetchTile(
        `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/${z}/${x}/${y}.jpeg`
      );
      if (res) contentType = 'image/jpeg';
      break;
    }

    case 'BEL':
      res = await fetchTile(
        `https://cartoweb.wmts.ngi.be/1.0.0/topo/default/3857/${z}/${y}/${x}.png`
      );
      break;

    case 'NOR':
      res = await fetchTile(
        `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${z}/${y}/${x}.png`
      );
      break;

    case 'USA':
      res = await fetchTile(
        `https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/${z}/${y}/${x}`
      );
      contentType = 'image/jpeg';
      break;

    case 'JPN':
      res = await fetchTile(
        `https://cyberjapandata.gsi.go.jp/xyz/std/${z}/${x}/${y}.png`
      );
      break;
  }

  if (res) return { res, contentType };

  // Fallback: Thunderforest Outdoors
  if (!tfKey) return null;
  const tfRes = await fetchTile(
    `https://tile.thunderforest.com/outdoors/${z}/${x}/${y}.png?apikey=${tfKey}`
  );
  if (tfRes) return { res: tfRes, contentType: 'image/png' };
  return null;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const xStr = sp.get('x');
  const yStr = sp.get('y');
  const zStr = sp.get('z');
  const dark = sp.get('dark') === '1';

  if (!xStr || !yStr || !zStr) {
    return NextResponse.json({ error: 'x, y, z are required' }, { status: 400 });
  }

  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);
  const z = parseInt(zStr, 10);

  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    return NextResponse.json({ error: 'x, y, z must be integers' }, { status: 400 });
  }

  const [lat, lng] = tileCenterLatLng(z, x, y);
  const iso = getCountry(lat, lng);

  // GB is covered by the OS tile layer on top — return transparent to avoid
  // a redundant OS Leisure_3857 request for tiles that will never be visible.
  if (iso === 'GBR') {
    const transparent = await getTransparentTile();
    return new NextResponse(new Uint8Array(transparent), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=1209600, s-maxage=1209600' },
    });
  }

  const result = await getProviderTile(iso, z, x, y);

  if (!result) {
    const missing = !process.env.THUNDERFOREST_API_KEY ? 500 : 502;
    return new NextResponse(null, { status: missing });
  }

  const buffer = await result.res.arrayBuffer();

  const cacheHeaders = {
    'Cache-Control': 'public, max-age=1209600, s-maxage=1209600',
  };

  if (dark) {
    const processed = await applyDarkMode(buffer);
    return new NextResponse(new Uint8Array(processed), {
      headers: { 'Content-Type': 'image/png', ...cacheHeaders },
    });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': result.contentType, ...cacheHeaders },
  });
}
