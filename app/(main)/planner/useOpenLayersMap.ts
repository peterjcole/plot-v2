'use client';

import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls } from 'ol/control';
import TileLayer from 'ol/layer/Tile';
import TileGrid from 'ol/tilegrid/TileGrid';
import XYZ from 'ol/source/XYZ';
import { get as getProjection, fromLonLat } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import OSM from 'ol/source/OSM';
import { OS_PROJECTION, OS_TILE_URL, OS_DEFAULT_CENTER, OS_ZOOM } from '@/lib/map-config';

export function useOpenLayersMap(targetRef: React.RefObject<HTMLDivElement | null>) {
  const [map, setMap] = useState<Map | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!targetRef.current || initRef.current) return;
    initRef.current = true;

    // Register EPSG:27700 projection
    proj4.defs(OS_PROJECTION.code, OS_PROJECTION.proj4);
    register(proj4);

    const projection = getProjection(OS_PROJECTION.code)!;

    // 1:25k tile grid — minZoom 8 means OL upscales zoom-8 tiles for lower views
    const hiResTileGrid = new TileGrid({
      resolutions: OS_PROJECTION.resolutions,
      origin: OS_PROJECTION.origin,
      minZoom: 8,
    });

    // Regular tile grid for overview-style OS tiles at lower zoom levels
    const overviewTileGrid = new TileGrid({
      resolutions: OS_PROJECTION.resolutions,
      origin: OS_PROJECTION.origin,
    });

    // OSM base layer for geographic context when zoomed out beyond OS tile range
    const osmLayer = new TileLayer({
      source: new OSM(),
      maxZoom: 3,
    });

    // OS overview tiles at low-to-mid zooms
    const osOverviewLayer = new TileLayer({
      source: new XYZ({
        url: OS_TILE_URL,
        projection: projection,
        tileGrid: overviewTileGrid,
      }),
      maxZoom: 6,
    });

    // OS 1:25k tiles — upscaled at zoom 6-7, native at 8-9
    const os25kLayer = new TileLayer({
      source: new XYZ({
        url: OS_TILE_URL,
        projection: projection,
        tileGrid: hiResTileGrid,
      }),
      minZoom: 6,
    });

    const center = fromLonLat(
      [OS_DEFAULT_CENTER.lng, OS_DEFAULT_CENTER.lat],
      OS_PROJECTION.code
    );

    const olMap = new Map({
      target: targetRef.current,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      layers: [osmLayer, osOverviewLayer, os25kLayer],
      view: new View({
        projection: projection,
        center: center,
        zoom: OS_ZOOM.default,
        minZoom: OS_ZOOM.min,
        maxZoom: OS_ZOOM.max,
        resolutions: OS_PROJECTION.resolutions,
      }),
    });

    setMap(olMap);

    return () => {
      olMap.setTarget(undefined);
      setMap(null);
      initRef.current = false;
    };
  }, [targetRef]);

  return map;
}
