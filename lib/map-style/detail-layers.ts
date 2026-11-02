import { palette } from './palette';

// Styles for tile-provider's /prow detail tiles: OS NGD rights of way (`prow`),
// the OS path network (`path`) and field boundaries (`fieldboundary`).
//
// OS's own ngd-base vector tiles carry no paths or field boundaries below z16,
// so on the OS Vector base map these layers fill that gap, handing over to
// ngd-base's own path/field-boundary layers at DETAIL_HANDOVER_ZOOM. Over other
// base maps they're an optional overlay (paths + rights of way only).

export const DETAIL_SOURCE = 'detail';

// tile-provider only builds z15 tiles; OL under/overzooms them.
export const DETAIL_TILE_ZOOM = 15;

// Style zoom where ngd-base's own path & field boundary layers take over.
export const DETAIL_HANDOVER_ZOOM = 16;

// Coarsest view resolution (m/px, EPSG:27700) the detail layer renders at.
// One step coarser (7 m/px) needs ~4x as many z15 tiles for the same viewport.
export const DETAIL_MAX_RESOLUTION = 4;

export interface DetailStyleOptions {
  dark: boolean;
  // Over satellite/topo rather than as part of the OS Vector base map
  overlay: boolean;
}

// Highway dedication descriptions from OS NGD trn-rami-highwaydedication
const FOOTPATH = ['Pedestrian Way Or Footpath'];
const BRIDLEWAY = ['Bridleway', 'Cycle Track Or Cycle Way'];
const BYWAY = ['Restricted Byway', 'Byway Open To All Traffic'];

type Filter = unknown[];

// Shared with ngd-base's own path layer above the handover so the two match
export function getPathPaint(dark: boolean): Record<string, unknown> {
  return {
    'line-color': palette(dark).path,
    'line-width': 1.2,
    'line-dasharray': [2.5, 2],
  };
}

interface LineLayer {
  id: string;
  type: 'line';
  source: string;
  'source-layer': string;
  filter?: Filter;
  minzoom?: number;
  maxzoom?: number;
  layout?: Record<string, unknown>;
  paint: Record<string, unknown>;
}

export interface DetailStyle {
  version: 8;
  sources: Record<string, { type: 'vector'; tiles: string[]; minzoom: number; maxzoom: number }>;
  layers: LineLayer[];
}

const descIn = (values: string[]): Filter => ['in', ['get', 'description'], ['literal', values]];

function line(
  id: string,
  sourceLayer: string,
  paint: Record<string, unknown>,
  extra: Partial<LineLayer> = {},
): LineLayer {
  return {
    id,
    type: 'line',
    source: DETAIL_SOURCE,
    'source-layer': sourceLayer,
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint,
    ...extra,
  };
}

export function getDetailStyle(tileUrl: string, { dark, overlay }: DetailStyleOptions): DetailStyle {
  const c = palette(dark);
  const layers: LineLayer[] = [];

  // Field boundaries and plain paths are part of the base map below the handover;
  // as an overlay only paths are drawn (field boundaries add noise over imagery).
  if (!overlay) {
    layers.push(
      line('detail-fieldboundary', 'fieldboundary', {
        'line-color': c.fieldBoundary,
        'line-width': 1,
      }, { maxzoom: DETAIL_HANDOVER_ZOOM }),
    );
  }

  const pathExtra = overlay ? {} : { maxzoom: DETAIL_HANDOVER_ZOOM };
  if (overlay) {
    layers.push(line('detail-path-casing', 'path', { 'line-color': c.overlayCasing, 'line-width': 2.5 }));
  }
  layers.push(line('detail-path', 'path', getPathPaint(dark), pathExtra));

  // Rights of way sit on top of the path network they usually overlap
  if (overlay) {
    layers.push(line('detail-prow-casing', 'prow', { 'line-color': c.overlayCasing, 'line-width': 3.5 }));
  }
  const prowWidth = overlay ? 2.4 : 2;
  layers.push(
    line('detail-prow-footpath', 'prow', {
      'line-color': c.footpath,
      'line-width': prowWidth,
      'line-dasharray': [2, 1.4],
    }, { filter: descIn(FOOTPATH) }),
    line('detail-prow-bridleway', 'prow', {
      'line-color': c.bridleway,
      'line-width': prowWidth,
      'line-dasharray': [5, 1.5],
    }, { filter: descIn(BRIDLEWAY) }),
    line('detail-prow-byway', 'prow', {
      'line-color': c.byway,
      'line-width': prowWidth + 0.2,
      'line-dasharray': [5, 1.5, 1, 1.5],
    }, { filter: descIn(BYWAY) }),
  );

  return {
    version: 8,
    sources: {
      [DETAIL_SOURCE]: {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: DETAIL_TILE_ZOOM,
        maxzoom: DETAIL_TILE_ZOOM,
      },
    },
    layers,
  };
}
