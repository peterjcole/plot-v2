import LayerGroup from 'ol/layer/Group';
import OlVectorTileLayer from 'ol/layer/VectorTile';
import OlVectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { createXYZ } from 'ol/tilegrid';
import { applyStyle } from 'ol-mapbox-style';
import { NGD_TILE_URL, PROW_TILE_URL } from '@/lib/map-config';
import {
  DETAIL_MAX_RESOLUTION, DETAIL_SOURCE, DETAIL_TILE_ZOOM, OVERVIEW_MAX_RESOLUTION, OVERVIEW_TILE_ZOOM,
  FIELD_BOUNDARY_MAX_RESOLUTION, FIELD_BOUNDARY_MIN_RESOLUTION, FIELD_BOUNDARY_TILE_ZOOM,
  getDetailStyle, type DetailStyleOptions,
} from '@/lib/map-style/detail-layers';
import { getFieldBoundaryStyle, getVectorStyle, NGD_SOURCE } from '@/lib/map-style';
import { palette } from '@/lib/map-style/palette';

// The OS Vector base map is OS's ngd-base tiles plus a detail group that fills
// in what they lack below z16: tile-provider's detail tiles (paths, tracks,
// rights of way) and ngd-base's own z16 field boundaries loaded early. Shared
// by MainMap and the style lab.
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

// Detail tiles exist at only two zooms, so each layer's grid has that single
// zoom and OL reuses the tiles across view zooms: z15 (paths, tracks, rights
// of way) close in, z13 (rights of way only) further out. Field boundaries
// likewise come from a single-zoom grid of ngd-base's z16 tiles.
export function createDetailLayer(): LayerGroup {
  const fieldBoundaries = new OlVectorTileLayer({
    source: mvtSource(NGD_TILE_URL, FIELD_BOUNDARY_TILE_ZOOM, FIELD_BOUNDARY_TILE_ZOOM),
    minResolution: FIELD_BOUNDARY_MIN_RESOLUTION,
    maxResolution: FIELD_BOUNDARY_MAX_RESOLUTION,
    properties: { fieldBoundaries: true },
  });
  const detail = new OlVectorTileLayer({
    source: mvtSource(PROW_TILE_URL, DETAIL_TILE_ZOOM, DETAIL_TILE_ZOOM),
    maxResolution: DETAIL_MAX_RESOLUTION,
  });
  const overview = new OlVectorTileLayer({
    source: mvtSource(PROW_TILE_URL, OVERVIEW_TILE_ZOOM, OVERVIEW_TILE_ZOOM),
    minResolution: DETAIL_MAX_RESOLUTION,
    maxResolution: OVERVIEW_MAX_RESOLUTION,
    properties: { overview: true },
  });
  return new LayerGroup({ layers: [fieldBoundaries, overview, detail], visible: false, zIndex: 0.5 });
}

export function styleBaseLayer(layer: OlVectorTileLayer, dark: boolean): Promise<unknown> {
  // applyStyle skips the style's `background` layer for a single layer, which
  // left open sea and tidal channels showing whatever was behind the map
  layer.setBackground(palette(dark).sea);
  return applyStyle(layer, getVectorStyle(dark), { source: NGD_SOURCE, updateSource: false });
}

export function styleDetailLayer(group: LayerGroup, options: DetailStyleOptions): Promise<unknown> {
  return Promise.all(group.getLayers().getArray().map((layer) => {
    const vt = layer as OlVectorTileLayer;
    if (layer.get('fieldBoundaries')) {
      // Part of the base map only; over imagery they're noise
      vt.setVisible(!options.overlay);
      return applyStyle(vt, getFieldBoundaryStyle(options.dark), { source: NGD_SOURCE, updateSource: false });
    }
    return applyStyle(
      vt,
      getDetailStyle(PROW_TILE_URL, { ...options, overview: layer.get('overview') === true }),
      { source: DETAIL_SOURCE, updateSource: false },
    );
  }));
}
