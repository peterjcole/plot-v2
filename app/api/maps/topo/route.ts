import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import booleanIntersects from '@turf/boolean-intersects';
import { polygon } from '@turf/helpers';
import boundaries from '@/lib/country-boundaries.json';
import { applyDarkMode } from '@/lib/dark-tile';
import { stitchRetinaTile } from '@/lib/tile-stitch';

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

// ── Tile math ───────────────────────────────────────────────────────────────

function tilePolygon(z: number, x: number, y: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const toLatLng = (tx: number, ty: number): [number, number] => {
    const n = Math.PI - (2 * Math.PI * ty) / (1 << z);
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
    const lng = (tx / (1 << z)) * 360 - 180;
    return [lng, lat];
  };
  return polygon([[
    toLatLng(x,     y),
    toLatLng(x + 1, y),
    toLatLng(x + 1, y + 1),
    toLatLng(x,     y + 1),
    toLatLng(x,     y),
  ]]);
}

// ── Country detection (polygon intersection against Natural Earth 1:10m) ─────

function getCountry(z: number, x: number, y: number): string | null {
  const tile = tilePolygon(z, x, y);
  for (const feature of (boundaries as GeoJSON.FeatureCollection).features) {
    if (booleanIntersects(tile, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
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

async function fetchTileBuffer(dark: boolean, z: number, x: number, y: number): Promise<Buffer | null> {
  const iso = getCountry(z, x, y);

  // GB is covered by the OS tile layer — return transparent
  if (iso === 'GBR') return getTransparentTile();

  const result = await getProviderTile(iso, z, x, y);
  if (!result) return null;

  const buffer = await result.res.arrayBuffer();
  if (dark) return Buffer.from(await applyDarkMode(buffer));
  return Buffer.from(buffer);
}

const CACHE = 'public, max-age=1209600, s-maxage=1209600';

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

  if (sp.get('scale') === '2') {
    const buf = await stitchRetinaTile((tz, tx, ty) => fetchTileBuffer(dark, tz, tx, ty), z, x, y);
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE },
    });
  }

  const buf = await fetchTileBuffer(dark, z, x, y);
  if (!buf) {
    const missing = !process.env.THUNDERFOREST_API_KEY ? 500 : 502;
    return new NextResponse(null, { status: missing });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE },
  });
}
