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

    const tileGrid = new TileGrid({
      resolutions: OS_PROJECTION.resolutions,
      origin: OS_PROJECTION.origin,
    });

    const tileLayer = new TileLayer({
      source: new XYZ({
        url: OS_TILE_URL,
        projection: projection,
        tileGrid: tileGrid,
      }),
    });

    const center = fromLonLat(
      [OS_DEFAULT_CENTER.lng, OS_DEFAULT_CENTER.lat],
      OS_PROJECTION.code
    );

    const olMap = new Map({
      target: targetRef.current,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }),
      layers: [tileLayer],
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
