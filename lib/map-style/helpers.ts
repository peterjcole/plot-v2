// Small builders for MapLibre-spec style layers, rendered by ol-mapbox-style.

export type Expr = unknown[];

export interface StyleLayer {
  id: string;
  type: 'background' | 'fill' | 'line' | 'symbol';
  source?: string;
  'source-layer'?: string;
  filter?: Expr;
  minzoom?: number;
  maxzoom?: number;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

export const NGD_SOURCE = 'ngd-base';

// ngd-base serves OS Open Zoomstack layers up to z16 tiles and OS NGD feature
// layers from z16. Under plot's EPSG:27700 view the switch shows up at style
// zoom ~16.2 in southern England, so Zoomstack layers run slightly past 16
// (drawn underneath) to avoid a blank band at the handover.
export const NGD_MIN_ZOOM = 16;
export const ZOOMSTACK_MAX_ZOOM = 16.6;

// Zoomstack layers only carry numeric `_symbol` codes, taken from OS's own
// ngd-base Outdoor style.
export const ZS = {
  roads: {
    motorway: [0, 1, 2], primary: [3, 4, 5], aRoad: [6, 7], bRoad: [8, 9],
    minor: [10, 11, 12], local: [13, 14], restricted: [15, 16], busway: [17, 18], tunnel: [19],
  },
  railways: { multi: 0, narrow: 1, single: 2, tunnel: 3 },
  contours: { index: 0, normal: 1 },
  waterlines: { district: 0, local: 1, mhw: 2, mlw: 3, national: 4, regional: 5 },
} as const;

export const sym = (codes: readonly number[] | number): Expr =>
  typeof codes === 'number'
    ? ['==', ['get', '_symbol'], codes]
    : ['in', ['get', '_symbol'], ['literal', [...codes]]];

// NGD layers carry readable descriptions, often compound
// ("Heath Or Rough Grassland And Scrub"), so match on substrings.
export const descIs = (...values: string[]): Expr => ['in', ['get', 'description'], ['literal', values]];
export const descHas = (...parts: string[]): Expr =>
  ['any', ...parts.map((p) => ['in', p, ['coalesce', ['get', 'description'], '']])];

export const all = (...filters: Expr[]): Expr => ['all', ...filters];
export const not = (filter: Expr): Expr => ['!', filter];

// Linear interpolation over style zoom: zoom(14, 0.5, 18, 3)
export const zoom = (...stops: (number | Expr)[]): Expr => ['interpolate', ['linear'], ['zoom'], ...stops];

type Extra = Omit<StyleLayer, 'id' | 'type' | 'source-layer' | 'paint'>;

export const fill = (id: string, sourceLayer: string, paint: Record<string, unknown>, extra: Extra = {}): StyleLayer =>
  ({ id, type: 'fill', source: NGD_SOURCE, 'source-layer': sourceLayer, paint, ...extra });

export const line = (id: string, sourceLayer: string, paint: Record<string, unknown>, { layout, ...extra }: Extra = {}): StyleLayer =>
  ({ id, type: 'line', source: NGD_SOURCE, 'source-layer': sourceLayer, layout: { 'line-join': 'round', ...layout }, paint, ...extra });

export const symbol = (id: string, sourceLayer: string, layout: Record<string, unknown>, paint: Record<string, unknown>, extra: Omit<Extra, 'layout'> = {}): StyleLayer =>
  ({ id, type: 'symbol', source: NGD_SOURCE, 'source-layer': sourceLayer, layout, paint, ...extra });
