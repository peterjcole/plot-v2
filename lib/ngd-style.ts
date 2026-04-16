// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseStyle = require('./ngd-outdoor-style.json') as StyleSpec;

// Minimal MapLibre GL types we need
interface PaintProps {
  'fill-color'?: string | unknown;
  'fill-opacity'?: number | unknown;
  'fill-outline-color'?: string | unknown;
  'line-color'?: string | unknown;
  'line-opacity'?: number | unknown;
  'line-width'?: number | unknown;
  'line-dasharray'?: number[] | unknown;
  'text-color'?: string | unknown;
  'text-halo-color'?: string | unknown;
  'circle-color'?: string | unknown;
  'circle-stroke-color'?: string | unknown;
  'background-color'?: string | unknown;
}

interface StyleLayer {
  id: string;
  type: string;
  'source-layer'?: string;
  paint?: PaintProps;
  filter?: unknown;
  layout?: Record<string, unknown>;
  minzoom?: number;
  maxzoom?: number;
}

interface StyleSpec {
  version: number;
  name?: string;
  sources: Record<string, { type: string; tiles?: string[]; minzoom?: number; maxzoom?: number }>;
  glyphs?: string;
  sprite?: string | unknown;
  layers: StyleLayer[];
}

// ─── OS Explorer (light) theme colours ──────────────────────────────────────
// Key: original NGD Outdoor colour  Value: Explorer replacement
// Colours calibrated against actual OS Explorer 1:25,000 raster tiles.
// General enclosed land is near-white; access land/open fell gets the warm peach.
// Contours and road hierarchy handled in applyExplorerAdjustments().
const EXPLORER_SWAP: Record<string, string> = {
  '#F5F5F0': '#f8f6f2', // GB land paper → near-white (OS explorer farmland is ~white)
  '#FAFAF3': '#f8f6f2', // European land
  '#F8F6F0': '#f8f6f2',
  '#F4F4EE': '#f8f6f2',
  '#F4F0D3': '#f4e4c8', // access land / open fell → warm peach (OS distinctive)
  '#F7F3CA': '#f0e4a8', // sandy / beach
  '#EEEFDA': '#eee8d4', // semi-natural land — very slightly warm
  '#EAEAD2': '#e8e2cc', // foreshore
  '#EAEAD3': '#e8e2cc',
  '#EEE8D3': '#ece4cc',
  '#D1E7C3': '#c8d878', // woodland — calibrated to OS yellow-lime-green
  '#CEE6BD': '#bcd070', // woodland variant
  '#DDE6D5': '#c4d87c',
  '#DBE6D5': '#c0d47c',
  '#DCE5D3': '#bcce74',
  '#D6EDCF': '#cce480', // arable / grazing
  '#E4EFDA': '#d4e888', // bare earth / grass
  '#E3F0DB': '#d0e884',
  '#F3F9F4': '#e8f4c8',
  '#E2EFCE': '#f0f0b0', // national parks → pale yellow-green
  '#A9DDEF': '#aad4e8', // surface water fills
  '#AADEEF': '#aad4e8',
  '#A4DAEB': '#9ccce0', // waterlines
  '#96D6E7': '#88c4e0',
  '#D8E6F3': '#c0d8f0',
  '#E4F3F4': '#c8e4f0',
  '#7ED2E0': '#78c8e0',
  '#74CEE7': '#70c4e0',
  '#3AC2E7': '#38b8e0',
  '#08B7E7': '#08b0e0',
};

// ─── Dark theme colour replacements ──────────────────────────────────────────
// Map every colour from the outdoor style to its dark-mode equivalent.
// Groups: paper/land, vegetation, water, roads, urban, text, misc
const DARK_SWAP: Record<string, string> = {
  // Background / sea
  '#FEFFFF': '#0e1520',

  // Paper (land)
  '#F5F5F0': '#1e1a16',
  '#FAFAF3': '#1c1814',
  '#F8F6F0': '#1c1814',
  '#F4F4EE': '#1c1814',
  '#F4F0D3': '#201c14',
  '#F7F3CA': '#221e10',
  '#EEEFDA': '#1e1e14',

  // Foreshore
  '#EAEAD2': '#242018',
  '#EAEAD3': '#242018',
  '#EEE8D3': '#242018',
  '#E8E4DD': '#26211c',
  '#DCD7C6': '#282418',
  '#BBB49C': '#302c20',

  // Woodland / vegetation
  '#D1E7C3': '#1a2c12',
  '#CEE6BD': '#182b10',
  '#DDE6D5': '#1e2e16',
  '#DBE6D5': '#1e2e16',
  '#DCE5D3': '#202e14',
  '#D6EDCF': '#1e2c14',
  '#E4EFDA': '#1e2818',
  '#E3F0DB': '#1e2a14',
  '#F3F9F4': '#1c2416',
  '#8CC78B': '#143810',
  '#77C776': '#103410',
  '#3AC2E7': '#184430',

  // National parks
  '#E2EFCE': '#201e14',

  // Surface water / rivers / lakes
  '#A9DDEF': '#182438',
  '#AADEEF': '#182438',
  '#A4DAEB': '#1a2840',
  '#96D6E7': '#162034',
  '#D8E6F3': '#182030',
  '#E4F3F4': '#182430',
  '#7ED2E0': '#163040',
  '#74CEE7': '#162e40',
  '#08B7E7': '#104070',
  '#F3D8E7': '#30182c', // some inland water

  // Urban areas (slightly lighter than background)
  '#C6C6C1': '#32302c',
  '#CECCCA': '#302e2a',
  '#CCCBCB': '#302e2a',
  '#E6E6E6': '#343230',
  '#EAEAE4': '#303028',
  '#BFBFBF': '#2e2c28',
  '#BDBDBD': '#2e2c28',
  '#BABABA': '#2e2c28',
  '#B3B3B3': '#2c2a26',
  '#B2B1B1': '#2c2a26',
  '#B0B0B0': '#2c2a26',

  // Roads — casings (coloured borders, override by applyDarkAdjustments)
  '#4E94A3': '#305898', // motorway casing
  '#7A9CA3': '#2a4870',
  '#6A99A3': '#284568',
  '#73A06F': '#505a3c', // primary casing
  '#83A080': '#485238',
  '#A09C92': '#604030', // A road casing
  '#9F9C93': '#4e3e28', // B road casing
  '#8C8C8C': '#3a322a', // local road casing
  '#949290': '#3a322a',
  '#95968F': '#383028',
  '#949197': '#403c40', // railway

  // Roads — fills (slightly lighter than background #1c1814 to be visible)
  '#FFFFFF': '#383028', // road fill — was nearly-invisible #302c28
  '#AAC7A9': '#383e2c', // primary fill
  '#A0C79F': '#383e2c',

  // Arable / extra
  '#AEB4A6': '#303028',

  // Brown / orange tones (contours, cliff)
  '#857660': '#c89828', // contour lines → bright amber in dark mode
  '#978282': '#3c2828',
  '#CCBEB4': '#3a3028',
  '#BEBEB4': '#363028',
  '#CCC352': '#4a4420', // misc

  // Text colours
  '#000000': '#d8d0c4',
  '#AF9031': '#c0a848',
  '#A79720': '#b89820',
};

// ─── rgba() helper ────────────────────────────────────────────────────────────
// Parse "rgba(r,g,b,a)" into components; returns null if not rgba format
function parseRgba(v: string): { r: number; g: number; b: number; a: number } | null {
  const m = v.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: +m[4] };
}

function rgbaToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Swap a single colour value (string) using the provided map
function swapColor(val: string, map: Record<string, string>): string {
  const upper = val.toUpperCase();
  if (map[upper]) return map[upper];

  const rgba = parseRgba(val);
  if (rgba) {
    const hex = rgbaToHex(rgba.r, rgba.g, rgba.b);
    const swapped = map[hex];
    if (swapped) {
      // Rebuild as rgba() preserving alpha
      const nr = parseInt(swapped.slice(1, 3), 16);
      const ng = parseInt(swapped.slice(3, 5), 16);
      const nb = parseInt(swapped.slice(5, 7), 16);
      return `rgba(${nr},${ng},${nb},${rgba.a})`;
    }
  }
  return val;
}

// Apply a colour map to a paint object, only touching plain string colour fields
function applyColorMapToPaint(paint: PaintProps, map: Record<string, string>): void {
  const colorFields = [
    'fill-color', 'fill-outline-color', 'line-color',
    'text-color', 'text-halo-color', 'circle-color',
    'circle-stroke-color', 'background-color',
  ] as const;
  for (const field of colorFields) {
    const v = paint[field];
    if (typeof v === 'string') {
      paint[field as 'fill-color'] = swapColor(v, map);
    }
  }
}

// ─── Per-source-layer targeted adjustments ───────────────────────────────────

function applyExplorerAdjustments(layer: StyleLayer): void {
  const paint = layer.paint;
  if (!paint) return;
  const sl = layer['source-layer'];
  const id = layer.id;

  // Contours: OS Explorer raster uses a vivid orange-brown (#f7955b).
  // Override both colour AND width (base style uses a stops expression that can
  // mismatch ol-mapbox-style zoom offsets, making contours near-invisible).
  if (sl === 'Contours') {
    paint['line-color'] = '#d87840';
    paint['line-width'] = id.includes('/Index') ? 1.1 : 0.7;
    paint['line-opacity'] = id.includes('/Index') ? 0.85 : 0.65;
  }

  // National parks: bump opacity
  if (sl === 'National_parks' || sl === 'National Park:1' || sl === 'National Park:2') {
    if (typeof paint['fill-opacity'] === 'number') {
      paint['fill-opacity'] = Math.min(paint['fill-opacity'] * 2, 0.7);
    }
  }

  // Woodland rgba variants: calibrated to OS yellow-lime-green (#c8d878 family)
  if (
    (sl === 'Woodland:3' || sl === 'Woodland:2' || sl === 'Woodland:1') &&
    typeof paint['fill-color'] === 'string'
  ) {
    const rgba = parseRgba(paint['fill-color']);
    if (rgba) {
      paint['fill-color'] = `rgba(185,208,112,${rgba.a})`;
    }
  }

  // Roads: OS Explorer colour hierarchy.
  // Casing layers end in "/1", fill layers end in "/0".
  // Both casing AND fill are coloured so the road body reads correctly at all widths.
  if (sl === 'Roads' && layer.type === 'line' && typeof paint['line-color'] === 'string') {
    const isCasing = id.endsWith('/1');
    if (id.includes('/Motorway')) {
      paint['line-color'] = isCasing ? '#1a58a8' : '#78b8e8';
    } else if (id.includes('/Primary')) {
      paint['line-color'] = isCasing ? '#a02818' : '#e89888';
    } else if (id.includes('/A Road')) {
      paint['line-color'] = isCasing ? '#c04018' : '#f0b070';
    } else if (id.includes('/B Road')) {
      paint['line-color'] = isCasing ? '#a07010' : '#f0e068';
    } else if (id.includes('/Minor') || id.includes('/Local') || id.includes('/Restricted')) {
      paint['line-color'] = isCasing ? '#888480' : '#ffffff';
    }
  }

  // PRoW paths: green dashes (bridleway convention; NGD _symbol doesn't expose
  // footpath vs bridleway distinction so we use a single colour for all paths).
  if (sl === 'trn_ntwk_pathlink' && layer.type === 'line') {
    paint['line-color'] = '#2a8c2a';
    paint['line-opacity'] = 0.9;
    paint['line-dasharray'] = [5, 4];
    paint['line-width'] = 1.4;
  }
}

function applyDarkAdjustments(layer: StyleLayer): void {
  const paint = layer.paint;
  if (!paint) return;
  const sl = layer['source-layer'];
  const id = layer.id;

  // Contours: golden amber, override width to ensure visibility regardless of
  // any zoom-offset issue between MapLibre GL stops and ol-mapbox-style.
  if (sl === 'Contours') {
    paint['line-color'] = '#c89828';
    paint['line-width'] = id.includes('/Index') ? 1.3 : 0.85;
    paint['line-opacity'] = id.includes('/Index') ? 0.95 : 0.85;
  }

  // Roads: need enough contrast to be visible on the very dark background (#1c1814).
  // Casings are the colour-coded element; fills are just slightly lighter than bg.
  if (sl === 'Roads' && layer.type === 'line' && typeof paint['line-color'] === 'string') {
    const isCasing = id.endsWith('/1');
    if (id.includes('/Motorway')) {
      paint['line-color'] = isCasing ? '#305898' : '#283848';
    } else if (id.includes('/Primary')) {
      paint['line-color'] = isCasing ? '#505a3c' : '#383e2c';
    } else if (id.includes('/A Road')) {
      paint['line-color'] = isCasing ? '#604030' : '#3c2c1e';
    } else if (id.includes('/B Road')) {
      paint['line-color'] = isCasing ? '#4e3e28' : '#342c1c';
    } else {
      paint['line-color'] = isCasing ? '#3a322a' : '#2e2820';
    }
  }

  // PRoW paths: bright green on dark bg — algorithm F on #2a8c2a gives ~#44cc44
  if (sl === 'trn_ntwk_pathlink' && layer.type === 'line') {
    paint['line-color'] = '#44cc44';
    paint['line-opacity'] = 0.9;
    paint['line-dasharray'] = [5, 4];
    paint['line-width'] = 1.4;
  }

  // Labels: light text on dark background
  if (layer.type === 'symbol') {
    if (typeof paint['text-color'] === 'string') paint['text-color'] = '#c8c0b0';
    else if (!paint['text-color']) paint['text-color'] = '#c8c0b0';
    if (typeof paint['text-halo-color'] === 'string') paint['text-halo-color'] = '#1c1814';
    else if (!paint['text-halo-color']) paint['text-halo-color'] = '#1c1814';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getNgdStyle(dark: boolean, tileUrl: string): StyleSpec {
  // Deep clone: fast-enough for ~450 KB that only runs when user switches to OS Vector
  const style = JSON.parse(JSON.stringify(baseStyle)) as StyleSpec;

  // Override tile source to our proxy
  style.sources = {
    'ngd-base': {
      type: 'vector',
      tiles: [tileUrl],
      minzoom: 6,
      maxzoom: 19,
    },
  };

  // Remove glyph / sprite references that would attempt to load with API keys embedded
  // ol-mapbox-style uses CSS/canvas fonts so glyphs PBFs are unused; sprites for icons
  // are optional — the text labels still render via web fonts.
  delete style.glyphs;
  // Keep sprite undefined so OL doesn't try to fetch it with embedded key
  style.sprite = undefined as unknown as string;

  const colorMap = dark ? DARK_SWAP : EXPLORER_SWAP;

  for (const layer of style.layers) {
    // Lower minzoom for PRoW path links so they appear at walking-map zoom levels.
    // The NGD base style sets these to zoom 16 (street-level only).
    if (layer['source-layer'] === 'trn_ntwk_pathlink' && (layer.minzoom ?? 0) > 13) {
      layer.minzoom = 13;
    }

    if (!layer.paint) continue;

    // Global colour swap based on lookup table
    applyColorMapToPaint(layer.paint, colorMap);

    // Source-layer–specific tweaks
    if (dark) {
      applyDarkAdjustments(layer);
    } else {
      applyExplorerAdjustments(layer);
    }
  }

  return style;
}
