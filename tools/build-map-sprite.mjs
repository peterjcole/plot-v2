#!/usr/bin/env node
// Builds the OS Vector style's sprite (fill patterns for land cover) from the
// inline SVG symbols below: public/map-style/sprite{,@2x}.{png,json}.
// Symbols are drawn on transparent tiles and layered over a flat fill colour.
//
// Usage: node tools/build-map-sprite.mjs

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(import.meta.dirname, '..', 'public', 'map-style');

const TREE = '#5f8a2e';
const GRASS = '#7f9a52';
const MARSH = '#3c9fd6';
const ROCK = '#8a857c';
const SCRUB = '#a3bb83';
const HEATH = '#9a7f62';

// Deciduous: round canopy on a short trunk
const deciduous = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${TREE}" stroke-width="1.1" stroke-linecap="round">
    <path d="M0 3.5 V1.5"/><circle cx="0" cy="-1" r="2.6"/>
  </g>`;
// Coniferous: a narrow spike with drooping branches
const conifer = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${TREE}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M0 -4 V3.5 M-2.6 1.5 L0 -1.5 L2.6 1.5 M-1.8 -0.8 L0 -3 L1.8 -0.8"/>
  </g>`;
const tuft = (x, y, color, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="0.9" stroke-linecap="round">
    <path d="M-1.6 1.5 L-0.8 -1 M0 1.5 V-1.8 M1.6 1.5 L0.8 -1"/>
  </g>`;
const marshMark = (x, y) => `
  <g transform="translate(${x} ${y})" fill="none" stroke="${MARSH}" stroke-width="0.9" stroke-linecap="round">
    <path d="M-3.5 1.5 H3.5 M-2 -0.2 H2"/>
  </g>${tuft(x, y - 2.2, GRASS, 0.8)}`;
const dot = (x, y, r, color) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;

// name: [size, svg body] — patterns tile seamlessly, so keep marks off the edges
const SYMBOLS = {
  'pattern-deciduous': [32, deciduous(8, 9) + deciduous(24, 25)],
  'pattern-conifer': [32, conifer(8, 9) + conifer(24, 25)],
  'pattern-mixed': [32, deciduous(8, 9) + conifer(24, 25)],
  'pattern-scattered': [44, deciduous(11, 12, 0.85) + conifer(33, 34, 0.85)],
  'pattern-scrub': [28, dot(7, 7, 1, SCRUB) + dot(9.2, 8.4, 0.8, SCRUB) + dot(21, 21, 1, SCRUB) + dot(18.8, 22.4, 0.8, SCRUB)],
  'pattern-rough': [24, tuft(6, 7, GRASS) + tuft(18, 19, GRASS)],
  'pattern-heath': [22, tuft(5.5, 6.5, HEATH, 0.85) + dot(16.5, 16.5, 0.8, HEATH) + dot(14.5, 17.5, 0.8, HEATH)],
  'pattern-marsh': [24, marshMark(6, 8) + marshMark(18, 20)],
  'pattern-rock': [16, dot(4, 4, 0.8, ROCK) + dot(12, 12, 0.8, ROCK) + dot(10, 5, 0.5, ROCK) + dot(5, 11, 0.5, ROCK)],
  'pattern-orchard': [16, dot(4, 4, 1.4, TREE) + dot(12, 12, 1.4, TREE)],
};

async function build(pixelRatio) {
  const images = await Promise.all(Object.entries(SYMBOLS).map(async ([name, [size, body]]) => {
    const px = size * pixelRatio;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
    return { name, px, buffer: await sharp(Buffer.from(svg)).png().toBuffer() };
  }));

  // One row: small set, no packing needed
  const index = {};
  let x = 0;
  for (const img of images) {
    index[img.name] = { x, y: 0, width: img.px, height: img.px, pixelRatio };
    img.left = x;
    x += img.px;
  }
  const height = Math.max(...images.map((i) => i.px));
  const suffix = pixelRatio === 1 ? '' : `@${pixelRatio}x`;
  await sharp({ create: { width: x, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(images.map((i) => ({ input: i.buffer, left: i.left, top: 0 })))
    .png()
    .toFile(path.join(OUT, `sprite${suffix}.png`));
  fs.writeFileSync(path.join(OUT, `sprite${suffix}.json`), JSON.stringify(index, null, 2) + '\n');
}

fs.mkdirSync(OUT, { recursive: true });
await build(1);
await build(2);
console.log(`sprite written to ${OUT}`);
