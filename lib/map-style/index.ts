import { NGD_TILE_URL } from '@/lib/map-config';
import { palette } from './palette';
import { NGD_SOURCE, type StyleLayer } from './helpers';
import { boundaryLayers, buildingLayers, landLayers, reliefLayers, waterLayers } from './land-layers';
import { transportLayers } from './transport-layers';
import { labelLayers } from './label-layers';

export interface VectorStyle {
  version: 8;
  sprite: string;
  sources: Record<string, { type: 'vector'; tiles: string[]; minzoom: number; maxzoom: number }>;
  layers: StyleLayer[];
}

// plot's OS Vector base map style for OS's ngd-base tiles (paths and rights
// of way below street zoom come from the separate detail layer).
export function getVectorStyle(dark: boolean): VectorStyle {
  const c = palette(dark);
  return {
    version: 8,
    // ol-mapbox-style resolves the sprite against the page; built by tools/build-map-sprite.mjs
    sprite: `${typeof window === 'undefined' ? '' : window.location.origin}/map-style/sprite`,
    sources: {
      [NGD_SOURCE]: { type: 'vector', tiles: [NGD_TILE_URL], minzoom: 6, maxzoom: 19 },
    },
    layers: [
      ...landLayers(c),
      ...waterLayers(c),
      ...reliefLayers(c),
      ...boundaryLayers(c),
      ...buildingLayers(c),
      ...transportLayers(c),
      ...labelLayers(c),
    ],
  };
}

export { NGD_SOURCE };
