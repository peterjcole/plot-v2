import sharp from 'sharp';

// Reuses the HSL classification approach from lib/dark-tile.ts: OS Leisure
// raster pixels split cleanly on lightness into "fills" (paper, woodland,
// open/access land — l > 0.75) versus "features" (contours, paths, water,
// text, and blended orange contour pixels detected via raw RGB chroma,
// since HSL saturation is unreliable at high lightness).

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

export interface EpaperToneOptions {
  /** Number of grey levels to quantise to. 4 = TRMNL 2-bit palette, 2 = 1-bit fallback. */
  levels?: 2 | 4;
}

/**
 * Tone-maps an OS Leisure raster buffer for an e-paper display: classifies
 * each pixel as fill or feature (same split as applyDarkMode), lifts
 * contrast so features survive quantisation, then snaps to the target grey
 * levels. Deliberately never emits level 0 (pure black) — that value is
 * reserved for the route overlay composited on top, so the trace is the
 * only pure-black thing on screen.
 *
 * For levels: 4, output is one of {255, 170, 85} (paper / fill / feature).
 * For levels: 2, output is Floyd–Steinberg dithered {255, 0} — the pure
 * black/white fallback for a device left on 1-bit; the route overlay's own
 * white casing is what keeps it legible against dithered black pixels.
 */
export async function toEpaperTone(
  raw: Buffer,
  info: { width: number; height: number; channels: number },
  opts: EpaperToneOptions = {},
): Promise<Buffer> {
  const levels = opts.levels ?? 4;
  const { width, height, channels } = info;
  const data = Buffer.from(raw); // copy — don't mutate caller's buffer

  // Pass 1: classify each pixel to a greyscale "ink" value using the same
  // fill/feature split as applyDarkMode, before any quantisation.
  const grey = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [, s, l] = rgbToHsl(r, g, b);

    let ink: number; // 0 (darkest feature) .. 1 (paper white)
    if (l > 0.75) {
      const rawChroma = Math.max(r, g, b) - Math.min(r, g, b);
      const isFeatureBlend = (l < 0.86 && s > 0.06) || rawChroma > 35;
      if (isFeatureBlend) {
        // Blended contour/road/woodland-edge pixel — treat as a feature,
        // not a fill, so it doesn't get washed out to white.
        ink = 1 - Math.pow(1 - (l - 0.75) / 0.25, 1.4);
      } else {
        // Clean fill (paper, open land, light woodland tint).
        ink = 1 - (1 - l) * 0.55; // pulls toward white but keeps a faint fill tone
      }
    } else {
      // Contours, paths, water, settlement, text — the darker the source,
      // the darker we push it, with a lift so mid-lightness features don't
      // collapse into the fill band above.
      ink = Math.max(0, l * 0.75);
    }

    grey[p] = ink;
  }

  // Pass 2: quantise.
  const out = Buffer.alloc(width * height);
  if (levels === 2) {
    // Floyd–Steinberg dither to pure black/white, propagating error in
    // raster order (serpentine not needed at this resolution).
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const old = grey[idx];
        const newVal = old < 0.5 ? 0 : 1;
        const err = old - newVal;
        if (x + 1 < width) grey[idx + 1] += (err * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) grey[idx + width - 1] += (err * 3) / 16;
          grey[idx + width] += (err * 5) / 16;
          if (x + 1 < width) grey[idx + width + 1] += (err * 1) / 16;
        }
        out[idx] = newVal === 1 ? 255 : 0;
      }
    }
  } else {
    // 4-level palette: 255 (paper) / 170 (fill) / 85 (feature). Never 0 —
    // that's reserved for the route drawn on top.
    for (let i = 0; i < grey.length; i++) {
      const v = grey[i];
      out[i] = v > 0.72 ? 255 : v > 0.4 ? 170 : 85;
    }
  }

  // Expand single-channel grey back to the caller's channel count so the
  // buffer can be re-composited alongside the (still-RGB/RGBA) route SVG.
  const expanded = Buffer.alloc(data.length);
  for (let p = 0, i = 0; p < out.length; p++, i += channels) {
    expanded[i] = out[p];
    expanded[i + 1] = out[p];
    expanded[i + 2] = out[p];
    if (channels === 4) expanded[i + 3] = data[i + 3];
  }

  return expanded;
}

/** Final greyscale quantisation pass on an encoded PNG — belt-and-braces
 *  snap in case anti-aliasing from the composited route SVG introduced
 *  in-between values along its edges. */
export async function quantiseGreyPng(png: Buffer, levels: 2 | 4 = 4): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const v = data[i]; // already greyscale by this point (r===g===b)
    let snapped: number;
    if (levels === 2) {
      snapped = v < 128 ? 0 : 255;
    } else {
      snapped = v < 43 ? 0 : v < 128 ? 85 : v < 213 ? 170 : 255;
    }
    data[i] = data[i + 1] = data[i + 2] = snapped;
  }
  return sharp(data, { raw: { width, height, channels } }).png({ compressionLevel: 9 }).toBuffer();
}
