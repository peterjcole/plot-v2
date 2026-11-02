import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import { Fill, Stroke, Style, Text } from 'ol/style';
import { unByKey } from 'ol/Observable';
import type Map from 'ol/Map';
import type { FeatureLike } from 'ol/Feature';
import { palette } from '@/lib/map-style/palette';

// Explorer-style 1km National Grid for the OS Vector base map. plot's view is
// in EPSG:27700, so view coordinates are eastings/northings in metres.

const KM = 1000;

// View zoom 6 (14 m/px) and closer; further out the lines merge into a tint
export const GRID_MAX_RESOLUTION = 16;

// Labels sit just inside the top and left edges of the view, in pixels
const LABEL_INSET = 14;

type GridLayer = VectorLayer<VectorSource>;

export function createGridLayer(): GridLayer {
  return new VectorLayer({
    source: new VectorSource(),
    maxResolution: GRID_MAX_RESOLUTION,
    visible: false,
    zIndex: 0.6,
  });
}

// Two-digit kilometre figure, as printed in the margins of OS maps
const gridFigure = (metres: number) => String(Math.floor(metres / KM) % 100).padStart(2, '0');

export function styleGridLayer(layer: GridLayer, dark: boolean): void {
  const c = palette(dark);
  const line = new Style({ stroke: new Stroke({ color: c.grid, width: 0.8 }) });
  const label = (text: string, offsetX: number, offsetY: number) => new Style({
    text: new Text({
      text,
      font: '600 11px "IBM Plex Mono", ui-monospace, monospace',
      fill: new Fill({ color: c.gridLabel }),
      stroke: new Stroke({ color: c.halo, width: 3 }),
      offsetX,
      offsetY,
    }),
  });
  layer.setStyle((feature: FeatureLike) => {
    const axis = feature.get('label');
    if (!axis) return line;
    // Eastings sit beside their line, northings just above theirs
    return axis === 'e' ? label(feature.get('text'), 9, 0) : label(feature.get('text'), 0, -7);
  });
}

// Rebuilds the visible grid after every move. Lines cover a view's width/height
// beyond each edge so they're already there while panning.
export function bindGridLayer(map: Map, layer: GridLayer): () => void {
  const source = layer.getSource()!;

  const update = () => {
    source.clear();
    const res = map.getView().getResolution();
    const size = map.getSize();
    if (!layer.getVisible() || !res || !size || res >= GRID_MAX_RESOLUTION) return;

    const [minx, miny, maxx, maxy] = map.getView().calculateExtent(size);
    const w = maxx - minx;
    const h = maxy - miny;
    const x0 = Math.floor((minx - w) / KM) * KM;
    const y0 = Math.floor((miny - h) / KM) * KM;
    const features: Feature[] = [];

    for (let x = x0; x <= maxx + w; x += KM) {
      features.push(new Feature(new LineString([[x, miny - h], [x, maxy + h]])));
      if (x > minx && x < maxx) {
        features.push(new Feature({ geometry: new Point([x, maxy - LABEL_INSET * res]), label: 'e', text: gridFigure(x) }));
      }
    }
    for (let y = y0; y <= maxy + h; y += KM) {
      features.push(new Feature(new LineString([[minx - w, y], [maxx + w, y]])));
      if (y > miny && y < maxy) {
        features.push(new Feature({ geometry: new Point([minx + LABEL_INSET * res, y]), label: 'n', text: gridFigure(y) }));
      }
    }
    source.addFeatures(features);
  };

  const keys = [map.on('moveend', update), layer.on('change:visible', update)];
  update();
  return () => unByKey(keys);
}
