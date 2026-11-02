import type { Palette } from './palette';
import { type Expr, type StyleLayer, NGD_MIN_ZOOM, symbol, zoom } from './helpers';

// ol-mapbox-style turns these into CSS fonts and loads them from fontsource
const FONT = {
  place: ['IBM Plex Sans Condensed SemiBold'],
  placeMinor: ['IBM Plex Sans Condensed Medium'],
  road: ['IBM Plex Sans Condensed Regular'],
  italic: ['IBM Plex Sans Condensed Italic'],
  mono: ['IBM Plex Mono Medium'],
};

interface LabelSpec {
  font: string[];
  size: Expr | number;
  color: string;
  transform?: 'uppercase';
  spacing?: number;
  line?: boolean;
  field?: Expr;
}

function labels(id: string, sourceLayers: string[], spec: LabelSpec, c: Palette, extra: Partial<StyleLayer> = {}): StyleLayer[] {
  return sourceLayers.map((sl) => symbol(`label-${id}-${sl.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, sl, {
    'text-field': spec.field ?? ['get', '_name'],
    'text-font': spec.font,
    'text-size': spec.size,
    'text-max-width': 8,
    'text-padding': 3,
    ...(spec.transform ? { 'text-transform': spec.transform } : {}),
    ...(spec.spacing ? { 'text-letter-spacing': spec.spacing } : {}),
    ...(spec.line ? { 'symbol-placement': 'line', 'text-rotation-alignment': 'map' } : {}),
  }, {
    'text-color': spec.color,
    'text-halo-color': c.halo,
    'text-halo-width': 1.4,
  }, extra));
}

// Drawn in order of importance: later layers win collisions under declutter
export function labelLayers(c: Palette): StyleLayer[] {
  return [
    ...labels('road', ['Roads/label'], { font: FONT.road, size: zoom(12, 9, 16, 11), color: c.labelMinor, line: true }, c, { minzoom: 12 }),
    ...labels('road-ngd', ['trn_ntwk_road/label'], { font: FONT.road, size: 11, color: c.labelMinor, line: true }, c, { minzoom: NGD_MIN_ZOOM }),
    ...labels('path-ngd', ['trn_ntwk_path/label'], { font: FONT.italic, size: 10, color: c.labelMinor, line: true }, c, { minzoom: NGD_MIN_ZOOM }),
    ...labels('water-line', ['wtr_ntwk_waterlinkset/label'], { font: FONT.italic, size: 11, color: c.labelWater, line: true }, c),
    // Greenspace:1 names are generic types ("Public Park Or Garden"), so they're left out
    ...labels('site', ['Sites', 'Railway_stations'], { font: FONT.placeMinor, size: 10, color: c.labelMinor }, c),
    ...labels('named-point', ['gnm_fts_namedpoint'], { font: FONT.placeMinor, size: 10, color: c.labelMinor, field: ['get', 'name1_text'] }, c),
    ...labels('water', ['Water:1', 'Water:2'], { font: FONT.italic, size: zoom(12, 10, 16, 12), color: c.labelWater }, c),
    ...labels('wood', ['Woodland:1', 'Woodland:2'], { font: FONT.italic, size: zoom(12, 10, 16, 12), color: c.labelWood }, c),
    ...labels('relief', ['Landform:1', 'Landform:2', 'Landcover:2', 'Landcover:3'], { font: FONT.mono, size: zoom(12, 9, 16, 10.5), color: c.labelRelief, transform: 'uppercase', spacing: 0.15 }, c),
    ...labels('hamlet', ['Hamlet:1', 'Hamlet:2', 'Hamlet (Local)', 'Small Settlement', 'Small Settlements'], { font: FONT.placeMinor, size: zoom(12, 10, 16, 12), color: c.label }, c),
    ...labels('village', ['Village:1', 'Village:2', 'Village:3', 'Suburban Area:1', 'Suburban Area:2', 'Suburban Area:3'], { font: FONT.place, size: zoom(10, 11, 16, 15), color: c.label }, c),
    ...labels('town', ['Town:1', 'Town:2', 'Town:3', 'Town:4'], { font: FONT.place, size: zoom(8, 12, 16, 19), color: c.label }, c),
    ...labels('city', ['City:1', 'City:2', 'City:3', 'City:4', 'Capital:1', 'Capital:2', 'Capital:3', 'Capital:4'], { font: FONT.place, size: zoom(6, 13, 16, 22), color: c.label, transform: 'uppercase', spacing: 0.08 }, c),
  ];
}
