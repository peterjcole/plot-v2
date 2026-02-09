export const OS_PROJECTION = {
  code: 'EPSG:27700',
  proj4: '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs',
  resolutions: [896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75],
  origin: [-238375.0, 1376256.0] as [number, number],
};

export const OS_TILE_URL = '/api/maps?z={z}&x={x}&y={y}';
export const OS_DEFAULT_CENTER = { lat: 54.4, lng: -2.9 };
export const OS_ZOOM = { min: 0, max: 9, default: 7 };
