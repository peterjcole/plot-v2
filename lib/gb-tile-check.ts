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

  // Check all 4 corners of the tile. Using corners rather than just the center
  // means a tile whose area overlaps GB will be included even if its center
  // falls outside (e.g. coastal tiles over the English Channel at low zoom).
  const corners: [number, number][] = [
    [x,     y    ],
    [x + 1, y    ],
    [x,     y + 1],
    [x + 1, y + 1],
  ];

  for (const [cx, cy] of corners) {
    const osX = OS_ORIGIN[0] + cx * TILE_SIZE * res;
    const osY = OS_ORIGIN[1] - cy * TILE_SIZE * res;
    const [lng, lat] = proj4(OS_PROJECTION.proj4, '+proj=longlat +datum=WGS84', [osX, osY]);
    if (booleanPointInPolygon(point([lng, lat]), gbrFeature as GeoJSON.Feature<GeoJSON.MultiPolygon>)) {
      return true;
    }
  }

  return false;
}
