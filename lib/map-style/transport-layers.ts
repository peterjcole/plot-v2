import type { Palette } from './palette';
import { getPathPaint } from './detail-layers';
import {
  type Expr, type StyleLayer, NGD_MIN_ZOOM, ZOOMSTACK_MAX_ZOOM, ZS,
  descIs, fill, line, sym, zoom,
} from './helpers';

interface RoadClass {
  id: string;
  codes: readonly number[];
  colors: [casing: string, fill: string];
  minzoom: number;
  casing: Expr;
  fill: Expr;
  dashed?: boolean;
}

function roadClasses(c: Palette): RoadClass[] {
  // Lowest first so major roads draw over minor ones at junctions
  return [
    { id: 'restricted', codes: ZS.roads.restricted, colors: c.local, minzoom: 13, casing: zoom(13, 1.2, 15, 3.4, 17, 8), fill: zoom(13, 0.5, 15, 2.2, 17, 6.6), dashed: true },
    { id: 'local', codes: ZS.roads.local, colors: c.local, minzoom: 12, casing: zoom(12, 0.8, 14, 2.6, 15.5, 5, 17, 9), fill: zoom(12, 0.3, 14, 1.5, 15.5, 3.7, 17, 7.5) },
    { id: 'minor', codes: ZS.roads.minor, colors: c.minor, minzoom: 10, casing: zoom(10, 0.8, 13, 3, 15.5, 7.4, 17, 11), fill: zoom(10, 0.4, 13, 1.9, 15.5, 5.8, 17, 9.4) },
    { id: 'b', codes: ZS.roads.bRoad, colors: c.bRoad, minzoom: 9, casing: zoom(9, 1, 12, 3.2, 15.5, 8.4, 17, 12.5), fill: zoom(9, 0.5, 12, 2.1, 15.5, 6.8, 17, 10.8) },
    { id: 'a', codes: ZS.roads.aRoad, colors: c.aRoad, minzoom: 7, casing: zoom(7, 1, 12, 3.8, 15.5, 9.4, 17, 14), fill: zoom(7, 0.5, 12, 2.6, 15.5, 7.6, 17, 12.2) },
    { id: 'primary', codes: ZS.roads.primary, colors: c.primary, minzoom: 6, casing: zoom(6, 1, 12, 4, 15.5, 10, 17, 15), fill: zoom(6, 0.5, 12, 2.8, 15.5, 8.2, 17, 13.2) },
    { id: 'motorway', codes: ZS.roads.motorway, colors: c.motorway, minzoom: 6, casing: zoom(6, 1.2, 12, 4.4, 15.5, 11, 17, 17), fill: zoom(6, 0.6, 12, 3.1, 15.5, 9, 17, 15) },
  ];
}

export function transportLayers(c: Palette): StyleLayer[] {
  const classes = roadClasses(c);
  const zs = (r: RoadClass) => ({ minzoom: r.minzoom, filter: sym(r.codes) });
  return [
    // Street-level surfaces (NGD polygons); Zoomstack centrelines draw on top until they run out
    fill('ngd-road', 'trn_fts_roadtrackorpath', { 'fill-color': c.roadSurface, 'fill-outline-color': c.roadEdge }, { minzoom: NGD_MIN_ZOOM, filter: descIs('Road', 'Traffic Calming', 'Level Crossing', 'Shared Use Carriageway') }),
    fill('ngd-track', 'trn_fts_roadtrackorpath', { 'fill-color': c.rough }, { minzoom: NGD_MIN_ZOOM, filter: descIs('Track') }),
    fill('ngd-pavement', 'trn_fts_roadtrackorpath', { 'fill-color': c.site }, { minzoom: NGD_MIN_ZOOM, filter: descIs('Pavement', 'Path', 'Cycle Way') }),
    // Track and path edges dashed, as Explorer draws unfenced ways
    line('ngd-way-edge', 'trn_fts_roadtrackorpath', { 'line-color': c.track, 'line-width': zoom(16, 0.8, 19, 1.3), 'line-dasharray': [4, 2] }, { minzoom: NGD_MIN_ZOOM, filter: descIs('Track', 'Path', 'Cycle Way') }),
    // Path centrelines continue the detail layer's dashed paths at street zoom
    line('ngd-path', 'trn_ntwk_pathlink', getPathPaint(c), { minzoom: NGD_MIN_ZOOM }),

    line('road-tunnel', 'Roads', { 'line-color': c.roadEdge, 'line-width': zoom(12, 1, 16, 4), 'line-dasharray': [2, 1.5], 'line-opacity': 0.7 }, { minzoom: 12, maxzoom: ZOOMSTACK_MAX_ZOOM, filter: sym(ZS.roads.tunnel) }),
    ...classes.map((r) => line(`road-${r.id}-casing`, 'Roads', {
      'line-color': r.colors[0],
      'line-width': r.casing,
      ...(r.dashed ? { 'line-dasharray': [2, 1] } : {}),
    }, { ...zs(r), layout: { 'line-cap': 'round' } })),
    ...classes.map((r) => line(`road-${r.id}`, 'Roads', { 'line-color': r.colors[1], 'line-width': r.fill }, { ...zs(r), layout: { 'line-cap': 'round' } })),

    // Rail: dark line with a white sleeper dash, OS-style
    line('rail', 'Railways', { 'line-color': c.rail, 'line-width': zoom(9, 0.8, 13, 2.2, 16, 3.6) }, { minzoom: 9, maxzoom: ZOOMSTACK_MAX_ZOOM, filter: sym([ZS.railways.multi, ZS.railways.single, ZS.railways.narrow]) }),
    line('rail-dash', 'Railways', { 'line-color': c.railGap, 'line-width': zoom(12, 0.6, 13, 1.2, 16, 2), 'line-dasharray': [3, 3] }, { minzoom: 12, maxzoom: ZOOMSTACK_MAX_ZOOM, filter: sym(ZS.railways.multi) }),
    line('rail-tunnel', 'Railways', { 'line-color': c.rail, 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.6 }, { minzoom: 12, maxzoom: ZOOMSTACK_MAX_ZOOM, filter: sym(ZS.railways.tunnel) }),
    line('ngd-rail', 'trn_fts_cartographicraildetail', { 'line-color': c.rail, 'line-width': 1 }, { minzoom: NGD_MIN_ZOOM }),
  ];
}
