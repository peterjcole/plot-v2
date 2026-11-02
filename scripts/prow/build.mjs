/**
 * Build the detail tileset tile-provider serves at /prow: rights of way, paths
 * and tracks, all from open data, so serving tiles makes no OS API calls.
 *
 *   prow_ext  council rights of way (see sources.json), normalised onto the OS
 *             `description` values plot already styles, each kept only inside
 *             the area its source is authoritative for
 *   prow      OpenStreetMap rights of way (`designation=*`), everywhere the
 *             council data doesn't replace them (manifest `replaces`)
 *   path      OpenStreetMap footways, paths, bridleways, steps and cycleways,
 *             minus pavements and crossings (z15 only)
 *   track     OpenStreetMap tracks (z15 only)
 *
 * Output, in --out: detail.pmtiles (z13–z15; tile-provider only requests z13
 * and z15).
 *
 * Usage:
 *   node scripts/prow/build.mjs --src <download dir> --out <output dir> \
 *     --osm england-latest.osm.pbf,wales-latest.osm.pbf
 *
 * The .osm.pbf extracts come from https://download.geofabrik.de/europe/united-kingdom.html
 * Then upload under a new version and point tile-provider's DETAIL_TILES_KEY at it:
 *   wrangler r2 object put plot-hillshade/detail/<version>.pmtiles --file <out>/detail.pmtiles --remote
 *
 * Needs `unzip`, `osmium` and `tippecanoe` on PATH.
 */

import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, createWriteStream } from 'fs';
import { createInterface } from 'readline';
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
const osmExtracts = argValue('--osm').split(',');
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
      tippecanoe: { layer: 'prow_ext' },
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

const geojsonl = join(outDir, 'detail.geojsonl');
const out = createWriteStream(geojsonl);
const write = (feature) => out.write(`${JSON.stringify(feature)}\n`);
const report = [];
for (const source of manifest.sources) {
  const { shp, sha256 } = await download(source);
  const counts = {};
  for await (const feature of readSource(source, shp, areas)) {
    write(feature);
    counts[feature.properties.description] = (counts[feature.properties.description] ?? 0) + 1;
  }
  report.push({ id: source.id, sha256, counts });
  console.log(source.id, counts);
}

// --- OpenStreetMap ----------------------------------------------------------

const OSM_PROW = {
  public_footpath: 'Pedestrian Way Or Footpath',
  public_bridleway: 'Bridleway',
  restricted_byway: 'Restricted Byway',
  byway_open_to_all_traffic: 'Byway Open To All Traffic',
};
const OSM_PATHS = new Set(['footway', 'path', 'bridleway', 'steps', 'cycleway']);
// Pavements and crossings run alongside roads; OS's path network leaves them out
const ROADSIDE = new Set(['sidewalk', 'crossing', 'traffic_island']);

const replaced = manifest.replaces.map((code) => {
  const polygons = areas.authority.get(code);
  const xs = polygons.flat(2).map((c) => c[0]);
  const ys = polygons.flat(2).map((c) => c[1]);
  return { polygons, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});
const isReplaced = ([x, y]) => replaced.some(({ polygons, bbox: [w, s, e, n] }) =>
  x >= w && x <= e && y >= s && y <= n && inPolygons([x, y], polygons));

function osmExport() {
  const dir = join(outDir, 'osm');
  mkdirSync(dir, { recursive: true });
  const merged = join(dir, 'merged.osm.pbf');
  const filtered = join(dir, 'filtered.osm.pbf');
  const lines = join(dir, 'ways.geojsonl');
  // Geofabrik extracts overlap at their borders; merge drops the duplicates
  execFileSync('osmium', ['merge', ...osmExtracts.map((f) => join(srcDir, f)), '-o', merged, '--overwrite'], { stdio: 'inherit' });
  execFileSync('osmium', [
    'tags-filter', merged, '-o', filtered, '--overwrite',
    `w/highway=${[...OSM_PATHS, 'track'].join(',')}`,
    `w/designation=${Object.keys(OSM_PROW).join(',')}`,
  ], { stdio: 'inherit' });
  execFileSync('osmium', [
    'export', filtered, '-o', lines, '--overwrite', '-f', 'geojsonseq',
    '--geometry-types=linestring', '-x', 'print_record_separator=false',
  ], { stdio: 'inherit' });
  return lines;
}

const osmCounts = { prow: {}, path: 0, track: 0, replaced: 0 };
for await (const text of createInterface({ input: createReadStream(osmExport()) })) {
  if (!text) continue;
  const { geometry, properties: tags } = JSON.parse(text);
  const coordinates = geometry.coordinates.map(([x, y]) => [round(x), round(y)]);
  const feature = (layer, properties = {}, minzoom) => write({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties,
    tippecanoe: minzoom ? { layer, minzoom } : { layer },
  });

  if (tags.highway === 'track') {
    feature('track', {}, 15);
    osmCounts.track++;
  } else if (OSM_PATHS.has(tags.highway) && !ROADSIDE.has(tags.footway)) {
    feature('path', {}, 15);
    osmCounts.path++;
  }

  const description = OSM_PROW[tags.designation];
  if (!description) continue;
  if (isReplaced(midVertex([coordinates]))) {
    osmCounts.replaced++;
    continue;
  }
  feature('prow', { description, source: 'osm' });
  osmCounts.prow[description] = (osmCounts.prow[description] ?? 0) + 1;
}
report.push({ id: 'osm', extracts: osmExtracts, counts: osmCounts });
console.log('osm', osmCounts);

await new Promise((resolve) => out.end(resolve));
writeFileSync(join(outDir, 'build-report.json'), JSON.stringify(report, null, 2));

// Layers come from each feature's `tippecanoe.layer`; paths and tracks only
// reach the z15 detail tiles, so the z13 overview tiles stay small.
execFileSync('tippecanoe', [
  '-q', '-o', join(outDir, 'detail.pmtiles'), '--force',
  '-Z13', '-z15',
  '--no-feature-limit', '--no-tile-size-limit',
  '--attribution', ['© OpenStreetMap contributors', ...manifest.sources.map((s) => s.attribution)].join(', '),
  geojsonl,
], { stdio: 'inherit' });
