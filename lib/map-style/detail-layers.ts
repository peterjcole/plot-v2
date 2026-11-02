import { palette, type Palette } from './palette';

// Styles for tile-provider's /prow detail tiles: OS NGD rights of way (`prow`),
// the OS path network (`path`), tracks (`track`) and field boundaries (`fieldboundary`).
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

// Zoomed out beyond that, rights of way alone come from z13 overview tiles,
// down to view zoom 6 (14 m/px).
export const OVERVIEW_TILE_ZOOM = 13;
export const OVERVIEW_MAX_RESOLUTION = 16;

export interface DetailStyleOptions {
  dark: boolean;
  // Over satellite rather than as part of the OS Vector base map
  overlay: boolean;
  // Style for the z13 overview tiles, which only carry rights of way
  overview?: boolean;
}

// Highway dedication descriptions from OS NGD trn-rami-highwaydedication
const FOOTPATH = ['Pedestrian Way Or Footpath'];
const BRIDLEWAY = ['Bridleway', 'Cycle Track Or Cycle Way'];
const BYWAY = ['Restricted Byway', 'Byway Open To All Traffic'];

type Filter = unknown[];

// Shared with ngd-base's own path layer above the handover so the two match
export function getPathPaint(c: Palette): Record<string, unknown> {
  return {
    'line-color': c.path,
    'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.2, 16, 1.7, 19, 2.2],
    'line-dasharray': [2.5, 1.6],
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

export function getDetailStyle(tileUrl: string, { dark, overlay, overview = false }: DetailStyleOptions): DetailStyle {
  const c = palette(dark);
  const layers: LineLayer[] = [];

  // Field boundaries and plain paths are part of the base map below the handover;
  // as an overlay only paths are drawn (field boundaries add noise over imagery).
  if (!overlay && !overview) {
    layers.push(
      line('detail-fieldboundary', 'fieldboundary', {
        'line-color': c.fieldBoundary,
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.1, 16, 1.6],
      }, { maxzoom: DETAIL_HANDOVER_ZOOM }),
    );
  }

  // Tracks: a pale strip between dashed dark edges, as Explorer draws them.
  // At street zoom ngd-base's own track surfaces take over.
  if (!overview) {
    const trackExtra = overlay ? {} : { maxzoom: DETAIL_HANDOVER_ZOOM };
    layers.push(
      line('detail-track-edges', 'track', {
        'line-color': c.track,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.6, 16, 4.8],
        'line-dasharray': [1.4, 0.7],
      }, trackExtra),
      line('detail-track', 'track', {
        'line-color': c.local[1],
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.2, 16, 2.6],
      }, trackExtra),
    );
  }

  const pathExtra = overlay ? {} : { maxzoom: DETAIL_HANDOVER_ZOOM };
  if (overlay && !overview) {
    layers.push(line('detail-path-casing', 'path', { 'line-color': c.overlayCasing, 'line-width': 2.5 }));
  }
  if (!overview) layers.push(line('detail-path', 'path', getPathPaint(c), pathExtra));

  // Rights of way sit on top of the path network they usually overlap
  if (overlay) {
    layers.push(line('detail-prow-casing', 'prow', { 'line-color': c.overlayCasing, 'line-width': 3.5 }));
  }
  const prowWidth = (overlay ? 2.4 : 2) - (overview ? 0.4 : 0);
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
        minzoom: overview ? OVERVIEW_TILE_ZOOM : DETAIL_TILE_ZOOM,
        maxzoom: overview ? OVERVIEW_TILE_ZOOM : DETAIL_TILE_ZOOM,
      },
    },
    layers,
  };
}
