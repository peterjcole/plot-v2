/**
 * Build the council rights-of-way tileset that fills gaps in OS NGD's
 * highway-dedication data (see sources.json for what goes in and why).
 *
 * Downloads each source, normalises its path types onto the OS `description`
 * values plot already styles, keeps each feature only inside the area its
 * source is authoritative for (so overlapping datasets don't double-draw), and
 * tiles the result with tippecanoe at the two zooms tile-provider serves.
 *
 * Outputs, in --out:
 *   prow-ext.pmtiles  layer `prow_ext`, properties { description, source }, z13–z15
 *   areas.json        authorities where these sources replace OS's rights of way;
 *                     tile-provider drops OS `prow` features inside them
 *
 * Usage:
 *   node scripts/prow/build.mjs --src <download dir> --out <output dir>
 *
 * Then upload both under one version (tile-provider's PROW_EXT_KEY):
 *   wrangler r2 object put plot-hillshade/prow-ext/<version>.pmtiles --file <out>/prow-ext.pmtiles --remote
 *   wrangler r2 object put plot-hillshade/prow-ext/<version>.areas.json --file <out>/areas.json --remote
 *
 * Needs `unzip` and `tippecanoe` on PATH.
 */

import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import proj4 from 'proj4';
import * as shapefile from 'shapefile';
import { OS_PROJECTION } from '../../lib/map-config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, 'sources.json'), 'utf8'));

// Shared with the map's own feature filters (lib/map-style/detail-layers.ts)
const DESCRIPTIONS = new Set([
  'Pedestrian Way Or Footpath', 'Bridleway', 'Restricted Byway', 'Byway Open To All Traffic',
]);

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`missing ${name}`);
  return process.argv[i + 1];
}

const srcDir = argValue('--src');
const outDir = argValue('--out');
mkdirSync(outDir, { recursive: true });

const toWgs84 = proj4(OS_PROJECTION.proj4, 'EPSG:4326');
const round = (n) => Math.round(n * 1e6) / 1e6;

// --- boundaries -------------------------------------------------------------

async function fetchBoundaries(kind, codes) {
  if (codes.length === 0) return new Map();
  const url = manifest.boundaries[kind].replace('{codes}', codes.map((c) => `'${c}'`).join(','));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`boundaries ${kind}: ${res.status}`);
  const fc = await res.json();
  const byCode = new Map();
  for (const f of fc.features) {
    const code = f.properties.CTYUA24CD ?? f.properties.NPARK22CD;
    byCode.set(code, f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
  }
  for (const c of codes) if (!byCode.has(c)) throw new Error(`no ${kind} boundary for ${c}`);
  return byCode;
}

function inPolygons([x, y], polygons) {
  for (const rings of polygons) {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

// --- sources ----------------------------------------------------------------

async function download(source) {
  const dir = join(srcDir, source.id);
  const archive = join(dir, 'source.zip');
  if (!existsSync(archive)) {
    mkdirSync(dir, { recursive: true });
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`${source.id}: download ${res.status}`);
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    execFileSync('unzip', ['-oq', archive, '-d', dir]);
  }
  const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
  const shp = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.shp'));
  if (shp.length !== 1) throw new Error(`${source.id}: expected one .shp, found ${shp.length}`);
  return { shp: join(dir, shp[0]), sha256 };
}

// The vertex halfway along a line's vertices: cheap, and always on the line
function midVertex(lines) {
  const all = lines.flat();
  return all[Math.floor(all.length / 2)];
}

async function* readSource(source, shpPath, areas) {
  const within = source.within.authority?.map((c) => areas.authority.get(c))
    ?? source.within.park.map((c) => areas.park.get(c));
  const outside = source.outside?.park?.map((c) => areas.park.get(c)) ?? [];

  const reader = await shapefile.open(shpPath, undefined, { encoding: 'utf-8' });
  for (;;) {
    const { done, value: f } = await reader.read();
    if (done) return;
    if (!f.geometry) continue;

    const raw = f.properties[source.typeField];
    const description = source.types[raw];
    if (!DESCRIPTIONS.has(description)) {
      throw new Error(`${source.id}: unmapped ${source.typeField} value ${JSON.stringify(raw)}`);
    }

    // Drop M/Z values; shapefile gives PolyLineM coordinates as [x, y, m]
    const lines = (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates)
      .map((line) => line.map(([x, y]) => toWgs84.forward([x, y]).map(round)));

    const mid = midVertex(lines);
    if (!within.some((p) => inPolygons(mid, p))) continue;
    if (outside.some((p) => inPolygons(mid, p))) continue;

    yield {
      type: 'Feature',
      geometry: lines.length === 1
        ? { type: 'LineString', coordinates: lines[0] }
        : { type: 'MultiLineString', coordinates: lines },
      properties: { description, source: source.id },
    };
  }
}

// --- main -------------------------------------------------------------------

const authorityCodes = new Set(manifest.replaces);
const parkCodes = new Set();
for (const s of manifest.sources) {
  s.within.authority?.forEach((c) => authorityCodes.add(c));
  s.within.park?.forEach((c) => parkCodes.add(c));
  s.outside?.park?.forEach((c) => parkCodes.add(c));
}
const areas = {
  authority: await fetchBoundaries('authority', [...authorityCodes]),
  park: await fetchBoundaries('park', [...parkCodes]),
};

const geojsonl = join(outDir, 'prow-ext.geojsonl');
const out = createWriteStream(geojsonl);
const report = [];
for (const source of manifest.sources) {
  const { shp, sha256 } = await download(source);
  const counts = {};
  for await (const feature of readSource(source, shp, areas)) {
    out.write(`${JSON.stringify(feature)}\n`);
    counts[feature.properties.description] = (counts[feature.properties.description] ?? 0) + 1;
  }
  report.push({ id: source.id, sha256, counts });
  console.log(source.id, counts);
}
await new Promise((resolve) => out.end(resolve));

// Douglas–Peucker. tile-provider runs point-in-polygon tests against these
// areas inside a 10ms CPU budget, so they're simplified to ~50m; an OS feature
// within that of a boundary may be kept or dropped, which is harmless.
const AREA_TOLERANCE = 0.0005;

function simplify(ring) {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  // Rings are closed (first = last), so seed with the vertex farthest from the
  // start to give the first split a real baseline
  let far = 1;
  for (let i = 1; i < ring.length - 1; i++) {
    if (Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
      > Math.hypot(ring[far][0] - ring[0][0], ring[far][1] - ring[0][1])) far = i;
  }
  keep[0] = keep[far] = keep[ring.length - 1] = 1;
  const stack = [[0, far], [far, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - ring[i][1]) - (ax - ring[i][0]) * (by - ay)) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > AREA_TOLERANCE) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const areaFeatures = manifest.replaces.map((code) => {
  const polygons = areas.authority.get(code)
    .map((rings) => rings.map((r) => simplify(r).map(([x, y]) => [round(x), round(y)])))
    .filter((rings) => rings[0].length >= 4);
  const xs = polygons.flat(2).map((c) => c[0]);
  const ys = polygons.flat(2).map((c) => c[1]);
  return {
    type: 'Feature',
    properties: { code },
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    geometry: { type: 'MultiPolygon', coordinates: polygons },
  };
});
writeFileSync(join(outDir, 'areas.json'), JSON.stringify({ type: 'FeatureCollection', features: areaFeatures }));
writeFileSync(join(outDir, 'build-report.json'), JSON.stringify(report, null, 2));

// Only z13 and z15 are ever requested; tile-provider concatenates these tiles
// with its own uncompressed MVT, so they're stored uncompressed too.
execFileSync('tippecanoe', [
  '-q', '-o', join(outDir, 'prow-ext.pmtiles'), '--force',
  '-l', 'prow_ext', '-Z13', '-z15',
  '--no-tile-compression', '--no-feature-limit', '--no-tile-size-limit',
  '--attribution', manifest.sources.map((s) => s.attribution).join(', '),
  geojsonl,
], { stdio: 'inherit' });
