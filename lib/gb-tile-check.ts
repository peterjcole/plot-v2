import proj4 from 'proj4';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import boundaries from '@/lib/country-boundaries.json';
import { OS_PROJECTION } from '@/lib/map-config';

const OS_RESOLUTIONS = [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75];
const OS_ORIGIN = [-238375.0, 1376256.0];
const TILE_SIZE = 256;

const gbrFeature = (boundaries as GeoJSON.FeatureCollection).features.find(
  (f) => (f.properties as { ISO_A3: string }).ISO_A3 === 'GBR'
)!;

export function isOsTileInGB(z: number, x: number, y: number): boolean {
  if (z < 0 || z >= OS_RESOLUTIONS.length) return false;
  const res = OS_RESOLUTIONS[z];
  const centerX = OS_ORIGIN[0] + (x + 0.5) * TILE_SIZE * res;
  const centerY = OS_ORIGIN[1] - (y + 0.5) * TILE_SIZE * res;
  const [lng, lat] = proj4(OS_PROJECTION.proj4, '+proj=longlat +datum=WGS84', [centerX, centerY]);
  return booleanPointInPolygon(
    point([lng, lat]),
    gbrFeature as GeoJSON.Feature<GeoJSON.MultiPolygon>
  );
}
