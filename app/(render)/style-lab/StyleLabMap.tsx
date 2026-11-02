'use client';

import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import TileGrid from 'ol/tilegrid/TileGrid';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { fromExtent } from 'ol/geom/Polygon';
import { Fill, Stroke, Style } from 'ol/style';
import XYZ from 'ol/source/XYZ';
import { defaults as defaultControls } from 'ol/control';
import { fromLonLat, get as getProjection } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { OS_PROJECTION, OS_TILE_URL, OS_DARK_TILE_URL, OS_VIEW_RESOLUTIONS } from '@/lib/map-config';
import { createBaseLayer, createDetailLayer, styleBaseLayer, styleDetailLayer } from '@/lib/map-layers/vector';
import { bindGridLayer, createGridLayer, styleGridLayer } from '@/lib/map-layers/grid';
import 'ol/ol.css';

declare global {
  interface Window { __LAB_READY__?: boolean }
}

// Sample activity traces (run, hike, cycle at MainMap's background and hovered
// opacities) for checking the base map stays below them
const TRACES = ['#E07020', '#40B060', '#4080C0'];

// Query params: lat, lng, z (view zoom), layer=vector|ref, theme=light|dark,
// traces=1 (sample activity traces), dim=1 (MainMap's dim base map layer)
export default function StyleLabMap() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const sp = new URLSearchParams(window.location.search);
    const lat = Number(sp.get('lat') ?? 51.67);
    const lng = Number(sp.get('lng') ?? -0.77);
    const z = Number(sp.get('z') ?? 9);
    const dark = sp.get('theme') === 'dark';
    const showRef = sp.get('layer') === 'ref';
    const showTraces = sp.get('traces') === '1';
    const dim = sp.get('dim') === '1';

    proj4.defs(OS_PROJECTION.code, OS_PROJECTION.proj4);
    register(proj4);
    const projection = getProjection(OS_PROJECTION.code)!;

    const layers = [];
    const grid = createGridLayer();
    if (showRef) {
      layers.push(new TileLayer({
        source: new XYZ({
          url: dark ? OS_DARK_TILE_URL : OS_TILE_URL,
          projection,
          tileGrid: new TileGrid({ resolutions: OS_PROJECTION.resolutions, origin: OS_PROJECTION.origin }),
        }),
      }));
    } else {
      const base = createBaseLayer();
      const detail = createDetailLayer();
      base.setVisible(true);
      detail.setVisible(true);
      styleBaseLayer(base, dark).catch(() => {});
      styleDetailLayer(detail, { dark, overlay: false }).catch(() => {});
      grid.setVisible(true);
      styleGridLayer(grid, dark);
      layers.push(base, detail, grid);
    }

    const map = new Map({
      target: ref.current,
      layers,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      view: new View({
        projection,
        center: fromLonLat([lng, lat], OS_PROJECTION.code),
        zoom: z,
        resolutions: OS_VIEW_RESOLUTIONS,
      }),
    });

    const unbindGrid = bindGridLayer(map, grid);

    const [minx, miny, maxx, maxy] = map.getView().calculateExtent([window.innerWidth, window.innerHeight]);
    const w = maxx - minx;
    const h = maxy - miny;
    if (dim) {
      map.addLayer(new VectorLayer({
        source: new VectorSource({ features: [new Feature(fromExtent([minx - w, miny - h, maxx + w, maxy + h]))] }),
        style: new Style({ fill: new Fill({ color: 'rgba(0, 0, 0, 0.45)' }) }),
        zIndex: 1,
      }));
    }
    if (showTraces) {
      // Each colour twice: background opacity (left) and hovered (right)
      const features = TRACES.flatMap((color, i) => [0.55, 0.9].map((alpha, j) => {
        const x = minx + w * (0.15 + 0.12 * i + 0.45 * j);
        const f = new Feature(new LineString([[x, miny], [x + w * 0.1, miny + h * 0.5], [x, maxy]]));
        const [r, g, b] = [1, 3, 5].map((k) => parseInt(color.slice(k, k + 2), 16));
        f.setStyle(new Style({ stroke: new Stroke({ color: `rgba(${r},${g},${b},${alpha})`, width: j ? 9 : 5 }) }));
        return f;
      }));
      map.addLayer(new VectorLayer({ source: new VectorSource({ features }), zIndex: 2 }));
    }

    // Styles apply asynchronously; wait for a render with everything loaded
    let timer: ReturnType<typeof setTimeout>;
    map.on('rendercomplete', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { window.__LAB_READY__ = true; }, 1500);
    });

    return () => { clearTimeout(timer); unbindGrid(); map.setTarget(undefined); };
  }, []);

  return <div ref={ref} style={{ width: '100vw', height: '100vh', background: '#fff' }} />;
}
