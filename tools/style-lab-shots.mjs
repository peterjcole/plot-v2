#!/usr/bin/env node
// Renders the style lab (app/(render)/style-lab) for each scene × zoom and
// composes contact sheets: plot's vector style beside the OS 1:25k raster
// reference, optionally with a "before" column from an earlier run.
//
// Needs `pnpm run dev` running. Tile responses are cached on disk, so repeat
// runs make no OS API calls.
//
// Usage: node tools/style-lab-shots.mjs --out <dir> [--cache <dir>] [--before <dir>]
//          [--theme light|dark] [--scenes a,b] [--zooms 7,8,9] [--no-ref]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const SCENES = {
  sevenoaks: { lat: 51.2655, lng: 0.1745, note: 'Kent farmland, woods, suburb' },
  chilterns: { lat: 51.665, lng: -0.775, note: 'Chiltern villages and rights of way' },
  stanage: { lat: 53.345, lng: -1.63, note: 'Peak District edge and moor' },
  langdale: { lat: 54.445, lng: -3.07, note: 'Lake District fell and crag' },
  bayswater: { lat: 51.51, lng: -0.175, note: 'Dense central London' },
  broads: { lat: 52.74, lng: 1.58, note: 'Norfolk Broads marsh and water' },
  newforest: { lat: 50.87, lng: -1.58, note: 'New Forest heath' },
  sevensisters: { lat: 50.76, lng: 0.15, note: 'Chalk coast and foreshore' },
};

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => {
    const [k, ...v] = a.trim().split(' ');
    return [k, v.join(' ') || true];
  }),
);
const out = args.out;
if (!out) throw new Error('--out <dir> is required');
const cacheDir = args.cache ?? path.join(out, '..', 'tile-cache');
const theme = args.theme ?? 'light';
const scenes = args.scenes ? args.scenes.split(',') : Object.keys(SCENES);
const zooms = (args.zooms ?? '7,8,9,10,11').split(',').map(Number);
const withRef = !args['no-ref'];
const PANEL = { w: 420, h: 315 };
const BASE = 'http://localhost:3000/style-lab';

fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, defaultViewport: { ...{ width: PANEL.w, height: PANEL.h }, deviceScaleFactor: 1 } });
const page = await browser.newPage();
await page.setRequestInterception(true);

// Disk cache for tiles and web fonts
const cacheable = (url) => /\/api\/(maps|prow-tiles)|fonts\.(googleapis|gstatic)|cdn\.jsdelivr/.test(url);
const cachePath = (url) => path.join(cacheDir, crypto.createHash('sha1').update(url).digest('hex'));
page.on('pageerror', (e) => console.warn(`  page error: ${e.message.slice(0, 200)}`));
page.on('request', (req) => {
  const url = req.url();
  const f = cachePath(url);
  if (cacheable(url) && fs.existsSync(f)) {
    const { status, headers } = JSON.parse(fs.readFileSync(`${f}.json`, 'utf8'));
    req.respond({ status, headers, body: fs.readFileSync(f) });
  } else {
    req.continue();
  }
});
page.on('response', async (res) => {
  const url = res.url();
  const f = cachePath(url);
  if (!cacheable(url) || fs.existsSync(f) || ![200, 204].includes(res.status())) return;
  try {
    const body = await res.buffer();
    const headers = { 'content-type': res.headers()['content-type'] ?? '', 'access-control-allow-origin': '*' };
    fs.writeFileSync(f, body);
    fs.writeFileSync(`${f}.json`, JSON.stringify({ status: res.status(), headers }));
  } catch { /* body unavailable (e.g. redirect) */ }
});

async function shot(scene, z, layer) {
  const { lat, lng } = SCENES[scene];
  await page.goto(`${BASE}?lat=${lat}&lng=${lng}&z=${z}&layer=${layer}&theme=${theme}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__LAB_READY__ === true', { timeout: 120000 }).catch(() => console.warn(`  timeout: ${scene} z${z} ${layer}`));
  // Next's dev overlay badge
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  return page.screenshot();
}

const label = (text, w) => Buffer.from(
  `<svg width="${w}" height="22"><rect width="100%" height="100%" fill="#111"/><text x="6" y="15" font-family="Menlo, monospace" font-size="12" fill="#eee">${text}</text></svg>`,
);

for (const scene of scenes) {
  const cols = [...(args.before ? ['before'] : []), 'after', ...(withRef ? ['1:25k'] : [])];
  const composites = [];
  const W = PANEL.w * cols.length + 4 * (cols.length - 1);
  composites.push({ input: label(`${scene} — ${SCENES[scene].note} — ${cols.join(' | ')}`, W), left: 0, top: 0 });
  for (const [row, z] of zooms.entries()) {
    const top = 22 + row * (PANEL.h + 4);
    const after = await shot(scene, z, 'vector');
    fs.writeFileSync(path.join(out, `${scene}-z${z}.png`), after);
    const panels = [];
    if (args.before) {
      const f = path.join(args.before, `${scene}-z${z}.png`);
      panels.push(fs.existsSync(f) ? fs.readFileSync(f) : await sharp({ create: { width: PANEL.w, height: PANEL.h, channels: 3, background: '#888' } }).png().toBuffer());
    }
    panels.push(after);
    // The 1:25k raster stops at z9; OL upsamples it beyond that
    if (withRef) panels.push(await shot(scene, z, 'ref'));
    panels.forEach((input, i) => composites.push({ input, left: i * (PANEL.w + 4), top }));
    composites.push({ input: label(`z${z}`, 40), left: 0, top: top + PANEL.h - 22 });
  }
  const H = 22 + zooms.length * (PANEL.h + 4);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#333' } })
    .composite(composites).png().toFile(path.join(out, `sheet-${scene}.png`));
  console.log(`${scene}: ${path.join(out, `sheet-${scene}.png`)}`);
}

await browser.close();
