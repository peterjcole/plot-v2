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

function osTilePolygon(z: number, x: number, y: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const res = OS_RESOLUTIONS[z];
  // 4 corners of the tile in EPSG:27700, then close the ring
  const tileCorners: [number, number][] = [
    [x,     y    ],
    [x + 1, y    ],
    [x + 1, y + 1],
    [x,     y + 1],
    [x,     y    ], // closed
  ];
  const wgs84Ring = tileCorners.map(([cx, cy]) => {
    const osX = OS_ORIGIN[0] + cx * TILE_SIZE * res;
    const osY = OS_ORIGIN[1] - cy * TILE_SIZE * res;
    return proj4(OS_PROJECTION.proj4, '+proj=longlat +datum=WGS84', [osX, osY]) as [number, number];
  });
  return polygon([wgs84Ring]);
}

export function isOsTileInGB(z: number, x: number, y: number): boolean {
  if (z < 0 || z >= OS_RESOLUTIONS.length) return false;
  return booleanIntersects(osTilePolygon(z, x, y), gbrFeature as GeoJSON.Feature<GeoJSON.MultiPolygon>);
}
