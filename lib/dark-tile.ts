import sharp from 'sharp';

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

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

export async function applyDarkMode(buffer: ArrayBuffer): Promise<Buffer> {
  const DARK_BG: [number, number, number] = [28, 24, 20];    // #1c1814 — paper/white areas
  const DARK_OLIVE: [number, number, number] = [26, 38, 14]; // #1a260e — access land / open terrain

  const { data, info } = await sharp(Buffer.from(buffer))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);

    let rNew: number, gNew: number, bNew: number;

    if (l > 0.75) {
      // Terrain fill or paper — lightness alone cleanly separates fills (l > 0.80)
      // from all map features (contours, paths, water, text — all l < 0.75).
      const isGreenFill = h > 0.22 && h < 0.48;
      if (isGreenFill) {
        // Forest/vegetation: route through features curve → medium dark green
        const lNew = Math.min(0.92, 1 - Math.pow(l, 0.85) * 0.85);
        const sNew = Math.min(1, s * 1.15);
        [rNew, gNew, bNew] = hslToRgb(h, sNew, lNew);
      } else {
        // At low zoom, orange contour/road pixels blend with the background, producing
        // high-lightness pixels that still have warm hue. Use raw RGB chroma (max-min,
        // 0-255) to detect them: blended contour pixels have rawChroma ≥ 34, while
        // access land fills (pale buff) top out at ~30. HSL saturation is unreliable
        // here because it amplifies artificially at high lightness values.
        const rawChroma = Math.max(r, g, b) - Math.min(r, g, b);
        const isWarmFeature = h < 0.20 && rawChroma > 35;
        if (isWarmFeature) {
          const lNew = Math.min(0.92, 1 - Math.pow(l, 0.85) * 0.85);
          const sNew = Math.min(1, s * 1.15);
          [rNew, gNew, bNew] = hslToRgb(h, sNew, lNew);
        } else {
          const isWarmFill = h > 0.07 && h < 0.22 && s > 0.08;
          const TARGET = isWarmFill ? DARK_OLIVE : DARK_BG;
          const blend = Math.min(1, (l - 0.75) / 0.25);
          rNew = Math.round(TARGET[0] * blend + r * (1 - l) * (1 - blend));
          gNew = Math.round(TARGET[1] * blend + g * (1 - l) * (1 - blend));
          bNew = Math.round(TARGET[2] * blend + b * (1 - l) * (1 - blend));
        }
      }
    } else {
      // Map features: contours, paths, water, text
      const lNew = Math.min(0.92, 1 - Math.pow(l, 0.85) * 0.85);
      const sNew = Math.min(1, s * 1.15);
      [rNew, gNew, bNew] = hslToRgb(h, sNew, lNew);
    }

    data[i] = rNew;
    data[i + 1] = gNew;
    data[i + 2] = bNew;
    // data[i + 3] alpha preserved
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}
