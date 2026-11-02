// Colour tokens for plot's OS Vector style. Light is matched to the OS Explorer
// 1:25,000 map: near-white farmland, pale grey-green woods, light orange
// contours, a coloured road hierarchy and bold green rights of way.
// Dark keeps Explorer's structure on a deep blue-teal night palette that sits
// under plot's panels, with mint rights of way (distinct from hike traces).

export interface Palette {
  sea: string;
  land: string;
  foreshore: string;
  urban: string;
  site: string;
  greenspace: string;
  wood: string;
  woodEdge: string;
  rough: string;
  heath: string;
  marsh: string;
  rock: string;
  orchard: string;
  water: string;
  waterEdge: string;
  stream: string;
  contour: string;
  contourIndex: string;
  slope: string;
  building: string;
  buildingEdge: string;
  fieldBoundary: string;
  wall: string;
  motorway: [casing: string, fill: string];
  primary: [casing: string, fill: string];
  aRoad: [casing: string, fill: string];
  bRoad: [casing: string, fill: string];
  minor: [casing: string, fill: string];
  local: [casing: string, fill: string];
  roadSurface: string;
  roadEdge: string;
  track: string;
  rail: string;
  railGap: string;
  path: string;
  footpath: string;
  bridleway: string;
  byway: string;
  // Knocks rights of way out from the boundaries and paths beneath them
  prowHalo: string;
  overlayCasing: string;
  grid: string;
  gridLabel: string;
  label: string;
  labelMinor: string;
  labelWater: string;
  labelWood: string;
  labelRelief: string;
  halo: string;
}

export const LIGHT: Palette = {
  sea: '#cfeaf8',
  land: '#fbfaf5',
  foreshore: '#f0e6bd',
  urban: '#f1ebe2',
  site: '#f3efe7',
  greenspace: '#e3efd3',
  wood: '#d8eac9',
  woodEdge: '#9cbf86',
  rough: '#f4f2e1',
  heath: '#eee7d6',
  marsh: '#e3f0ec',
  rock: '#e6e3dd',
  orchard: '#d9ebc6',
  water: '#c4e6f7',
  waterEdge: '#1fa3dd',
  stream: '#1fa3dd',
  contour: '#f0a06c',
  contourIndex: '#e3864a',
  slope: '#9c7a5c',
  building: '#f5cea6',
  buildingEdge: '#2b2621',
  fieldBoundary: '#4d5054',
  wall: '#46494c',
  motorway: ['#1d3f73', '#3f97dc'],
  primary: ['#1c3d26', '#2fa556'],
  aRoad: ['#4a1030', '#e6378a'],
  bRoad: ['#4a2e0c', '#fbb034'],
  minor: ['#4a4318', '#fff44f'],
  local: ['#3b352b', '#ffffff'],
  roadSurface: '#ffffff',
  roadEdge: '#4a453c',
  track: '#3b352b',
  rail: '#2e2b27',
  railGap: '#ffffff',
  path: '#2e2b26',
  footpath: '#00a651',
  bridleway: '#00a651',
  byway: '#00a651',
  prowHalo: 'rgba(255,255,255,0.7)',
  overlayCasing: 'rgba(255,255,255,0.55)',
  grid: 'rgba(38,150,214,0.75)',
  gridLabel: '#1c86c6',
  label: '#1f1d1a',
  labelMinor: '#4a463f',
  labelWater: '#1f6fa8',
  labelWood: '#3f5f1e',
  labelRelief: '#7a5232',
  halo: 'rgba(251,250,245,0.9)',
};

export const DARK: Palette = {
  sea: '#0d2c46',
  land: '#0f1d24',
  foreshore: '#1c2622',
  urban: '#142630',
  site: '#14242b',
  greenspace: '#12282a',
  wood: '#12352c',
  woodEdge: '#2b6a52',
  rough: '#12222a',
  heath: '#1c2129',
  marsh: '#11303a',
  rock: '#1c2830',
  orchard: '#132c2a',
  water: '#154870',
  waterEdge: '#3d9ede',
  stream: '#45a2de',
  contour: '#9c6a44',
  contourIndex: '#c48450',
  slope: '#6a6058',
  building: '#25373f',
  buildingEdge: '#56717c',
  fieldBoundary: '#58767f',
  wall: '#6a8a94',
  motorway: ['#08121a', '#4a8ed6'],
  primary: ['#08121a', '#38a862'],
  aRoad: ['#08121a', '#d0508a'],
  bRoad: ['#08121a', '#d29a46'],
  minor: ['#08121a', '#c4bc58'],
  local: ['#08121a', '#4e6a74'],
  roadSurface: '#2c3f47',
  roadEdge: '#4d6670',
  track: '#7d939a',
  rail: '#8597a0',
  railGap: '#0f1d24',
  path: '#a9bcc2',
  footpath: '#4fe0b0',
  bridleway: '#4fe0b0',
  byway: '#4fe0b0',
  prowHalo: 'rgba(15,29,36,0.75)',
  overlayCasing: 'rgba(7,14,20,0.8)',
  grid: 'rgba(80,160,220,0.38)',
  gridLabel: '#6fb2e2',
  label: '#e2ecef',
  labelMinor: '#a3b6bc',
  labelWater: '#6fbce8',
  labelWood: '#7fc4a0',
  labelRelief: '#c9a27c',
  halo: 'rgba(15,29,36,0.88)',
};

export const palette = (dark: boolean): Palette => (dark ? DARK : LIGHT);
