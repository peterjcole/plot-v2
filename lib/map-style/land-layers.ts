import type { Palette } from './palette';
import {
  type StyleLayer, NGD_SOURCE, NGD_MIN_ZOOM, ZOOMSTACK_MAX_ZOOM, ZS,
  all, descHas, descIs, fill, line, not, sym, zoom,
} from './helpers';

const ZS_UNTIL = { maxzoom: ZOOMSTACK_MAX_ZOOM };
const NGD_FROM = { minzoom: NGD_MIN_ZOOM };

// NGD land descriptions are compound; the first matching class wins
const WOOD = descHas('Coniferous Trees', 'Mixed Trees', 'Non-Coniferous Trees');
const SCATTERED_WOOD = descHas('Scattered Coniferous', 'Scattered Mixed', 'Scattered Non-Coniferous');
const WOOD_ONLY = all(WOOD, not(SCATTERED_WOOD));
const SCATTERED_ONLY = all(SCATTERED_WOOD, not(WOOD_ONLY));
// "Non-Coniferous Trees" contains "Coniferous Trees", hence the exclusions where used
const CONIFER = descHas('Coniferous Trees');
const DECIDUOUS = descHas('Non-Coniferous Trees');
const MIXED = descHas('Mixed Trees');
const MARSH = descHas('Marsh', 'Saltmarsh', 'Reeds');
const ROCK = descHas('Boulders Or Rock', 'Scree', 'Rock');
const HEATH = descHas('Heath');
const ROUGH = descHas('Rough Grassland', 'Scrub');
const SAND = descHas('Sand Or Shingle', 'Mud', 'Foreshore');

const pattern = (id: string, sourceLayer: string, image: string, extra: Partial<StyleLayer>) =>
  fill(id, sourceLayer, { 'fill-pattern': image }, extra);

export function landLayers(c: Palette): StyleLayer[] {
  return [
    { id: 'sea', type: 'background', paint: { 'background-color': c.sea } },
    fill('land', 'GB_land', { 'fill-color': c.land }),
    fill('land-europe', 'European_land', { 'fill-color': c.land }),
    fill('foreshore', 'Foreshore', { 'fill-color': c.foreshore }, ZS_UNTIL),

    // Low-zoom context
    fill('urban', 'Urban_areas', { 'fill-color': c.urban }, { maxzoom: 13 }),
    fill('greenspace', 'Greenspace:2', { 'fill-color': c.greenspace }, ZS_UNTIL),
    fill('sites', 'Functional_sites', { 'fill-color': c.site }, ZS_UNTIL),
    fill('wood', 'Woodland:3', { 'fill-color': c.wood }, ZS_UNTIL),
    line('wood-edge', 'Woodland:3', { 'line-color': c.woodEdge, 'line-width': zoom(13, 0.3, 16, 0.6), 'line-opacity': 0.7 }, { minzoom: 13, ...ZS_UNTIL }),

    // Street-level land cover (NGD)
    fill('ngd-land-rough', 'lnd_fts_land', { 'fill-color': c.rough }, { ...NGD_FROM, filter: ROUGH }),
    fill('ngd-land-heath', 'lnd_fts_land', { 'fill-color': c.heath }, { ...NGD_FROM, filter: HEATH }),
    fill('ngd-land-rock', 'lnd_fts_land', { 'fill-color': c.rock }, { ...NGD_FROM, filter: ROCK }),
    fill('ngd-land-sand', 'lnd_fts_land', { 'fill-color': c.foreshore }, { ...NGD_FROM, filter: SAND }),
    fill('ngd-land-marsh', 'lnd_fts_land', { 'fill-color': c.marsh }, { ...NGD_FROM, filter: MARSH }),
    fill('ngd-land-orchard', 'lnd_fts_land', { 'fill-color': c.orchard }, { ...NGD_FROM, filter: descHas('Orchard', 'Vineyard') }),
    fill('ngd-land-scattered', 'lnd_fts_land', { 'fill-color': c.greenspace }, { ...NGD_FROM, filter: SCATTERED_ONLY }),
    fill('ngd-land-wood', 'lnd_fts_land', { 'fill-color': c.wood }, { ...NGD_FROM, filter: WOOD_ONLY }),
    line('ngd-land-wood-edge', 'lnd_fts_land', { 'line-color': c.woodEdge, 'line-width': 0.6, 'line-opacity': 0.7 }, { ...NGD_FROM, filter: WOOD_ONLY }),

    // Symbols over the flat fills (fill-pattern replaces colour, so these are separate layers)
    pattern('wood-symbols', 'Woodland:3', 'pattern-mixed', { minzoom: 14, ...ZS_UNTIL }),
    pattern('ngd-conifer-symbols', 'lnd_fts_land', 'pattern-conifer', { ...NGD_FROM, filter: all(WOOD_ONLY, CONIFER, not(DECIDUOUS), not(MIXED)) }),
    pattern('ngd-deciduous-symbols', 'lnd_fts_land', 'pattern-deciduous', { ...NGD_FROM, filter: all(WOOD_ONLY, DECIDUOUS, not(MIXED)) }),
    pattern('ngd-mixed-symbols', 'lnd_fts_land', 'pattern-mixed', { ...NGD_FROM, filter: all(WOOD_ONLY, MIXED) }),
    pattern('ngd-scattered-symbols', 'lnd_fts_land', 'pattern-scattered', { ...NGD_FROM, filter: SCATTERED_ONLY }),
    pattern('ngd-rough-symbols', 'lnd_fts_land', 'pattern-rough', { ...NGD_FROM, filter: all(ROUGH, not(WOOD), not(HEATH), not(MARSH)) }),
    pattern('ngd-scrub-symbols', 'lnd_fts_land', 'pattern-scrub', { ...NGD_FROM, filter: all(descHas('Scrub'), not(WOOD), not(ROUGH)) }),
    pattern('ngd-heath-symbols', 'lnd_fts_land', 'pattern-heath', { ...NGD_FROM, filter: all(HEATH, not(MARSH)) }),
    pattern('ngd-marsh-symbols', 'lnd_fts_land', 'pattern-marsh', { ...NGD_FROM, filter: MARSH }),
    pattern('ngd-rock-symbols', 'lnd_fts_land', 'pattern-rock', { ...NGD_FROM, filter: ROCK }),
    pattern('ngd-orchard-symbols', 'lnd_fts_land', 'pattern-orchard', { ...NGD_FROM, filter: descHas('Orchard') }),
    fill('ngd-land-urban', 'lnd_fts_land', { 'fill-color': c.site }, { ...NGD_FROM, filter: descIs('Made Surface', 'Construction Site', 'Landfill', 'Quarry', 'Spoil Heap') }),
  ];
}

const majorRiver = (major: number, other: number) =>
  ['match', ['get', '_symbol'], [ZS.waterlines.national, ZS.waterlines.regional], major, other];

export function waterLayers(c: Palette): StyleLayer[] {
  return [
    fill('water', 'Surfacewater', { 'fill-color': c.water }, ZS_UNTIL),
    line('water-edge', 'Surfacewater', { 'line-color': c.waterEdge, 'line-width': zoom(12, 0.3, 16, 0.8) }, { minzoom: 12, ...ZS_UNTIL }),
    line('waterline-tide', 'Waterlines', { 'line-color': c.waterEdge, 'line-width': 0.6, 'line-opacity': 0.5 }, { ...ZS_UNTIL, filter: sym([ZS.waterlines.mhw, ZS.waterlines.mlw]) }),
    line('waterline', 'Waterlines', {
      'line-color': c.stream,
      // Zoom must be the outermost expression; rivers are twice the width of streams
      'line-width': zoom(10, majorRiver(0.8, 0.4), 16, majorRiver(2.4, 1.2)),
    }, { ...ZS_UNTIL, filter: not(sym([ZS.waterlines.mhw, ZS.waterlines.mlw])) }),

    fill('ngd-water', 'wtr_fts_water', { 'fill-color': c.water }, { ...NGD_FROM, filter: not(descIs('Reeds')) }),
    line('ngd-water-edge', 'wtr_fts_water', { 'line-color': c.waterEdge, 'line-width': 0.8 }, { ...NGD_FROM, filter: not(descIs('Reeds')) }),
    line('ngd-waterlink', 'wtr_ntwk_waterlink', { 'line-color': c.stream, 'line-width': zoom(16, 1, 19, 2) }, NGD_FROM),
  ];
}

export function reliefLayers(c: Palette): StyleLayer[] {
  // Zoomstack contours are the only relief data at every zoom (10m interval,
  // index every 50m); they carry no heights, so they can't be labelled.
  return [
    line('contour', 'Contours', {
      'line-color': c.contour,
      'line-width': zoom(11, 0.3, 15, 0.75, 18, 1),
      'line-opacity': zoom(11, 0.5, 15, 0.95),
    }, { minzoom: 11, filter: sym(ZS.contours.normal) }),
    line('contour-index', 'Contours', {
      'line-color': c.contourIndex,
      'line-width': zoom(9, 0.4, 15, 1.1, 18, 1.5),
      'line-opacity': zoom(9, 0.5, 15, 0.9),
    }, { minzoom: 9, filter: sym(ZS.contours.index) }),
    line('ngd-cliff', 'lnd_fts_landformline', { 'line-color': c.slope, 'line-width': 1.2 }, { ...NGD_FROM, filter: descHas('Cliff', 'Ridge Or Rock Line') }),
    line('ngd-slope', 'lnd_fts_landformline', { 'line-color': c.slope, 'line-width': 0.6, 'line-dasharray': [3, 2] }, { ...NGD_FROM, filter: descHas('Slope') }),
  ];
}

export function boundaryLayers(c: Palette): StyleLayer[] {
  return [
    line('ngd-fieldboundary', 'str_fts_fieldboundary', { 'line-color': c.fieldBoundary, 'line-width': zoom(16, 0.9, 19, 1.6) }, NGD_FROM),
    line('ngd-structureline', 'str_fts_structureline', { 'line-color': c.wall, 'line-width': zoom(16, 0.6, 19, 1.2), 'line-opacity': 0.85 }, NGD_FROM),
  ];
}

export function buildingLayers(c: Palette): StyleLayer[] {
  const paint = { 'fill-color': c.building, 'fill-outline-color': c.buildingEdge };
  return [
    fill('buildings-district', 'District_buildings', paint, { maxzoom: 13 }),
    fill('buildings-local', 'Local_buildings', paint, { minzoom: 13, ...ZS_UNTIL }),
    fill('ngd-buildings', 'bld_fts_buildingpart', { 'fill-color': c.building }, NGD_FROM),
    line('ngd-buildings-edge', 'bld_fts_buildingpart', { 'line-color': c.buildingEdge, 'line-width': zoom(16, 0.5, 19, 1) }, NGD_FROM),
  ];
}

export { NGD_SOURCE };
