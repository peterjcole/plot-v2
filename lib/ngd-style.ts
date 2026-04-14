// eslint-disable-next-line @typescript-eslint/no-require-imports
const baseStyle = require('./ngd-outdoor-style.json') as StyleSpec;

// Minimal MapLibre GL types we need
interface PaintProps {
  'fill-color'?: string | unknown;
  'fill-opacity'?: number | unknown;
  'fill-outline-color'?: string | unknown;
  'line-color'?: string | unknown;
  'line-opacity'?: number | unknown;
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
const EXPLORER_SWAP: Record<string, string> = {
  '#F5F5F0': '#f0e8d4', // GB land paper → warm cream (Explorer-like)
  '#FAFAF3': '#f0e8d4', // European land
  '#F8F6F0': '#f0e8d4',
  '#F4F4EE': '#f0e8d4',
  '#F4F0D3': '#e8dcc4',
  '#F7F3CA': '#f0e8a8', // sandy
  '#EEEFDA': '#eae4c8',
  '#EAEAD2': '#e4e0c4', // foreshore
  '#EAEAD3': '#e4e0c4',
  '#EEE8D3': '#e8e0c4',
  '#D1E7C3': '#9bc89c', // woodland (solid)
  '#CEE6BD': '#90c090', // woodland variant
  '#DDE6D5': '#a8d4a4',
  '#DBE6D5': '#a8d4a4',
  '#DCE5D3': '#b0d8a8',
  '#D6EDCF': '#c4e8bc', // arable / grazing
  '#E4EFDA': '#cce8c4', // bare earth / grass
  '#E3F0DB': '#c8e8c4',
  '#F3F9F4': '#e8f4e4',
  '#E2EFCE': '#fff8b8', // national parks → pale yellow
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

  // Roads — casings (darker borders)
  '#4E94A3': '#2a4a60', // motorway casing
  '#7A9CA3': '#263a50',
  '#6A99A3': '#243848',
  '#73A06F': '#2a4028', // primary casing
  '#83A080': '#2a3a28',
  '#A09C92': '#3a3530', // A road casing
  '#9F9C93': '#363230', // B road casing
  '#8C8C8C': '#3a3838', // local road casing
  '#949290': '#3a3838',
  '#95968F': '#383630',
  '#949197': '#403c40', // railway

  // Roads — fills (lighter)
  '#FFFFFF': '#302c28', // road fill
  '#AAC7A9': '#243a22', // primary fill
  '#A0C79F': '#243a22',

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

  // Contours: boost visibility — the Outdoor style uses 0.3 opacity which is too subtle
  if (sl === 'Contours') {
    paint['line-color'] = '#b87040'; // warm Explorer brown
    paint['line-opacity'] = id.includes('/Index') ? 0.75 : 0.55;
  }

  // National parks: bump opacity
  if (sl === 'National_parks' || sl === 'National Park:1' || sl === 'National Park:2') {
    if (typeof paint['fill-opacity'] === 'number') {
      paint['fill-opacity'] = Math.min(paint['fill-opacity'] * 2, 0.7);
    }
  }

  // Woodland rgba variants: standardise to Explorer green
  if (
    (sl === 'Woodland:3' || sl === 'Woodland:2' || sl === 'Woodland:1') &&
    typeof paint['fill-color'] === 'string'
  ) {
    const rgba = parseRgba(paint['fill-color']);
    if (rgba) {
      paint['fill-color'] = `rgba(140,195,142,${rgba.a})`;
    }
  }

  // Roads: OS Explorer colour hierarchy
  // Casing layers end with "/1"; fill layers end with "_N" (zoom number)
  if (sl === 'Roads' && layer.type === 'line' && typeof paint['line-color'] === 'string') {
    const isCasing = id.endsWith('/1');
    if (id.includes('/Motorway')) {
      paint['line-color'] = isCasing ? '#2060b0' : '#88c0e8';
    } else if (id.includes('/Primary')) {
      paint['line-color'] = isCasing ? '#b03020' : '#f0a898';
    } else if (id.includes('/A Road')) {
      if (isCasing) paint['line-color'] = '#c84818';
    } else if (id.includes('/B Road')) {
      if (isCasing) paint['line-color'] = '#b07810';
    }
  }
}

function applyDarkAdjustments(layer: StyleLayer): void {
  const paint = layer.paint;
  if (!paint) return;
  const sl = layer['source-layer'];
  const id = layer.id;

  // Contours: bright amber/golden to match raster dark mode
  if (sl === 'Contours') {
    paint['line-color'] = '#c89828';
    paint['line-opacity'] = id.includes('/Index') ? 0.9 : 0.7;
  }

  // Roads: subtle warm tones readable on dark background
  if (sl === 'Roads' && layer.type === 'line' && typeof paint['line-color'] === 'string') {
    const isCasing = id.endsWith('/1');
    if (isCasing) {
      if (id.includes('/Motorway')) paint['line-color'] = '#1a3858';
      else if (id.includes('/Primary')) paint['line-color'] = '#283020';
      else if (id.includes('/A Road')) paint['line-color'] = '#382818';
      else if (id.includes('/B Road')) paint['line-color'] = '#302818';
      else paint['line-color'] = '#2e2820';
    } else {
      // Fill colour — all roads use a dark warm tone
      paint['line-color'] = '#2a2620';
    }
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
