// Colour and weight tokens for plot's OS Vector style. Light is modelled on the
// OS Explorer 1:25,000 map: near-white farmland, yellow-green woods,
// orange-brown contours, a coloured road hierarchy and green rights of way.
// Dark keeps the same structure (dark theme is a separate design round).

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
  overlayCasing: string;
  label: string;
  labelMinor: string;
  labelWater: string;
  labelWood: string;
  labelRelief: string;
  halo: string;
}

export const LIGHT: Palette = {
  sea: '#c4e3f1',
  land: '#fbfaf5',
  foreshore: '#f0e6bd',
  urban: '#f1ebe2',
  site: '#f3efe7',
  greenspace: '#e1eec8',
  wood: '#cfe5a3',
  woodEdge: '#7da34a',
  rough: '#f4f2e1',
  heath: '#eee7d6',
  marsh: '#e3f0ec',
  rock: '#e6e3dd',
  orchard: '#dfedbe',
  water: '#a8d9f2',
  waterEdge: '#3c9fd6',
  stream: '#3c9fd6',
  contour: '#e39a5c',
  contourIndex: '#d27a36',
  slope: '#9c7a5c',
  building: '#efc996',
  buildingEdge: '#2b2621',
  fieldBoundary: '#3b3832',
  wall: '#3b3832',
  motorway: ['#1d3f73', '#4f9fe0'],
  primary: ['#1c3d26', '#4fae6c'],
  aRoad: ['#3a1a28', '#ec5f96'],
  bRoad: ['#3a2a14', '#f6a93c'],
  minor: ['#3a3424', '#ffe866'],
  local: ['#4a453c', '#ffffff'],
  roadSurface: '#ffffff',
  roadEdge: '#4a453c',
  track: '#8a7f6a',
  rail: '#2e2b27',
  railGap: '#ffffff',
  path: '#45453a',
  footpath: '#2a8c2a',
  bridleway: '#2a8c2a',
  byway: '#7a5a18',
  overlayCasing: 'rgba(255,255,255,0.55)',
  label: '#1f1d1a',
  labelMinor: '#4a463f',
  labelWater: '#1f6fa8',
  labelWood: '#3f5f1e',
  labelRelief: '#7a5232',
  halo: 'rgba(251,250,245,0.9)',
};

export const DARK: Palette = {
  sea: '#0e1520',
  land: '#1e1a16',
  foreshore: '#242018',
  urban: '#26211c',
  site: '#231f1a',
  greenspace: '#1e2a16',
  wood: '#1a2c12',
  woodEdge: '#2c4a1e',
  rough: '#221f18',
  heath: '#251f19',
  marsh: '#18241f',
  rock: '#2a2724',
  orchard: '#1e2a16',
  water: '#182438',
  waterEdge: '#2e5a86',
  stream: '#2e5a86',
  contour: '#a07828',
  contourIndex: '#c89828',
  slope: '#6a5440',
  building: '#302c24',
  buildingEdge: '#48423a',
  fieldBoundary: '#5a5448',
  wall: '#5a5448',
  motorway: ['#305898', '#283848'],
  primary: ['#3a6a44', '#2a3a2c'],
  aRoad: ['#604030', '#3c2c1e'],
  bRoad: ['#4e3e28', '#342c1c'],
  minor: ['#3a322a', '#2e2820'],
  local: ['#3a322a', '#2a241e'],
  roadSurface: '#2a241e',
  roadEdge: '#3a322a',
  track: '#5a5040',
  rail: '#5a5858',
  railGap: '#252323',
  path: '#c8c0b0',
  footpath: '#44cc44',
  bridleway: '#44cc44',
  byway: '#c89848',
  overlayCasing: 'rgba(14,21,32,0.8)',
  label: '#d8d0c0',
  labelMinor: '#b0a898',
  labelWater: '#6fa8d8',
  labelWood: '#8fb070',
  labelRelief: '#c09070',
  halo: 'rgba(28,24,20,0.85)',
};

export const palette = (dark: boolean): Palette => (dark ? DARK : LIGHT);
