'use client';

import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import TileGrid from 'ol/tilegrid/TileGrid';
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

// Query params: lat, lng, z (view zoom), layer=vector|ref, theme=light|dark
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
