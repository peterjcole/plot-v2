import OlVectorTileLayer from 'ol/layer/VectorTile';
import OlVectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { createXYZ } from 'ol/tilegrid';
import { applyStyle } from 'ol-mapbox-style';
import { NGD_TILE_URL, PROW_TILE_URL } from '@/lib/map-config';
import {
  DETAIL_MAX_RESOLUTION, DETAIL_SOURCE, DETAIL_TILE_ZOOM, getDetailStyle, type DetailStyleOptions,
} from '@/lib/map-style/detail-layers';
import { getVectorStyle, NGD_SOURCE } from '@/lib/map-style';

// The OS Vector base map is two vector tile layers: OS's ngd-base tiles, and
// tile-provider's detail tiles (paths, rights of way, field boundaries) that
// fill in what ngd-base lacks below z16. Shared by MainMap and the style lab.
//
// Sources are built here rather than by ol-mapbox-style, so (re)styling only
// ever swaps style functions and can't race an async source setup.

function mvtSource(url: string, minZoom: number, maxZoom: number): OlVectorTileSource {
  return new OlVectorTileSource({
    format: new MVT(),
    url,
    projection: 'EPSG:3857',
    // 512px tiles: the convention OS's and plot's styles are written for
    tileGrid: createXYZ({ minZoom, maxZoom, tileSize: 512 }),
  });
}

export function createBaseLayer(): OlVectorTileLayer {
  return new OlVectorTileLayer({
    source: mvtSource(NGD_TILE_URL, 6, 19),
    // Labels are decluttered, which also draws them above the detail layer
    declutter: true,
    visible: false,
    zIndex: 0,
  });
}

// Only z15 detail tiles exist, so the grid has that single zoom and OL reuses
// them at every view zoom.
export function createDetailLayer(): OlVectorTileLayer {
  return new OlVectorTileLayer({
    source: mvtSource(PROW_TILE_URL, DETAIL_TILE_ZOOM, DETAIL_TILE_ZOOM),
    maxResolution: DETAIL_MAX_RESOLUTION,
    visible: false,
    zIndex: 0.5,
  });
}

export function styleBaseLayer(layer: OlVectorTileLayer, dark: boolean): Promise<unknown> {
  return applyStyle(layer, getVectorStyle(dark), { source: NGD_SOURCE, updateSource: false });
}

export function styleDetailLayer(layer: OlVectorTileLayer, options: DetailStyleOptions): Promise<unknown> {
  return applyStyle(layer, getDetailStyle(PROW_TILE_URL, options), { source: DETAIL_SOURCE, updateSource: false });
}
