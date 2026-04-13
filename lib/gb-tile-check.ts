import proj4 from 'proj4';
import booleanIntersects from '@turf/boolean-intersects';
import { polygon } from '@turf/helpers';
import boundaries from '@/lib/country-boundaries.json';
import { OS_PROJECTION } from '@/lib/map-config';

const OS_RESOLUTIONS = [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75];
const OS_ORIGIN = [-238375.0, 1376256.0];
const TILE_SIZE = 256;

// Great Britain only — the GBR feature in Natural Earth is the full UK including
// Northern Ireland, but OS Maps covers Great Britain only. We filter to the
// sub-feature whose bounding box excludes NI (the largest sub-polygon by area).
// In practice the GBR MultiPolygon's first/largest ring is mainland GB.
const gbrFeature = (boundaries as GeoJSON.FeatureCollection).features.find(
  (f) => (f.properties as { ISO_A3: string }).ISO_A3 === 'GBR'
)!;

// 10 km leeway so that sea tiles near the GB coastline (estuaries, harbours, etc.)
// pass the intersection check. The Channel is ~33 km wide at its narrowest so
// this never reaches France: a tile 1 km off Calais is 32 km from England, well
// above the 10 km threshold.
const COASTAL_LEEWAY_METRES = 10_000;

function osTilePolygon(z: number, x: number, y: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const res = OS_RESOLUTIONS[z];
  const tileM = TILE_SIZE * res;

  // Expand tile bounds by coastal leeway in EPSG:27700 before projecting to WGS84.
  const osLeft   = OS_ORIGIN[0] + x       * tileM - COASTAL_LEEWAY_METRES;
  const osRight  = OS_ORIGIN[0] + (x + 1) * tileM + COASTAL_LEEWAY_METRES;
  const osTop    = OS_ORIGIN[1] -  y      * tileM + COASTAL_LEEWAY_METRES;
  const osBottom = OS_ORIGIN[1] - (y + 1) * tileM - COASTAL_LEEWAY_METRES;

  const toWgs84 = (ex: number, ey: number) =>
    proj4(OS_PROJECTION.proj4, '+proj=longlat +datum=WGS84', [ex, ey]) as [number, number];

  return polygon([[
    toWgs84(osLeft,  osTop),
    toWgs84(osRight, osTop),
    toWgs84(osRight, osBottom),
    toWgs84(osLeft,  osBottom),
    toWgs84(osLeft,  osTop),
  ]]);
}

export function isOsTileInGB(z: number, x: number, y: number): boolean {
  if (z < 0 || z >= OS_RESOLUTIONS.length) return false;
  return booleanIntersects(osTilePolygon(z, x, y), gbrFeature as GeoJSON.Feature<GeoJSON.MultiPolygon>);
}
