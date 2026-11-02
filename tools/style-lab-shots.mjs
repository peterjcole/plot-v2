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
//          [--ref-from <dir>] [--jobs 4] [--traces] [--dim]
//
// Reference shots are saved beside the vector ones (<scene>-z<z>-ref.png);
// --ref-from reuses them from an earlier run instead of rendering them again.

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
const refFrom = args['ref-from'];
const jobs = Number(args.jobs ?? 4);
const PANEL = { w: 420, h: 315 };
const BASE = 'http://localhost:3000/style-lab';

fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });


// Disk cache for tiles and web fonts
const cacheable = (url) => /\/api\/(maps|prow-tiles)|fonts\.(googleapis|gstatic)|cdn\.jsdelivr/.test(url);
const cachePath = (url) => path.join(cacheDir, crypto.createHash('sha1').update(url).digest('hex'));

// One browser per page: OL renders on animation frames, which background tabs don't get
const browsers = [];
async function newPage() {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: PANEL.w, height: PANEL.h, deviceScaleFactor: 1 } });
  browsers.push(browser);
  const [page] = await browser.pages();
  await page.setRequestInterception(true);
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
  return page;
}

// Pages are pooled so shots render in parallel
const idle = await Promise.all(Array.from({ length: jobs }, newPage));
const waiting = [];
async function withPage(fn) {
  const page = idle.pop() ?? await new Promise((resolve) => waiting.push(resolve));
  try {
    return await fn(page);
  } finally {
    const next = waiting.shift();
    if (next) next(page); else idle.push(page);
  }
}

const shot = (scene, z, layer) => withPage(async (page) => {
  const { lat, lng } = SCENES[scene];
  const extras = `${args.traces ? '&traces=1' : ''}${args.dim ? '&dim=1' : ''}`;
  await page.goto(`${BASE}?lat=${lat}&lng=${lng}&z=${z}&layer=${layer}&theme=${theme}${layer === 'vector' ? extras : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__LAB_READY__ === true', { timeout: 120000 }).catch(() => console.warn(`  timeout: ${scene} z${z} ${layer}`));
  // Next's dev overlay badge
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  return page.screenshot();
});

async function refShot(scene, z) {
  const reuse = refFrom && path.join(refFrom, `${scene}-z${z}-ref.png`);
  const buf = reuse && fs.existsSync(reuse) ? fs.readFileSync(reuse) : await shot(scene, z, 'ref');
  fs.writeFileSync(path.join(out, `${scene}-z${z}-ref.png`), buf);
  return buf;
}

const label = (text, w) => Buffer.from(
  `<svg width="${w}" height="22"><rect width="100%" height="100%" fill="#111"/><text x="6" y="15" font-family="Menlo, monospace" font-size="12" fill="#eee">${text}</text></svg>`,
);

const grey = await sharp({ create: { width: PANEL.w, height: PANEL.h, channels: 3, background: '#888' } }).png().toBuffer();

async function panelsFor(scene, z) {
  const [after, ref] = await Promise.all([shot(scene, z, 'vector'), withRef ? refShot(scene, z) : null]);
  fs.writeFileSync(path.join(out, `${scene}-z${z}.png`), after);
  const before = args.before && path.join(args.before, `${scene}-z${z}.png`);
  return [
    ...(args.before ? [before && fs.existsSync(before) ? fs.readFileSync(before) : grey] : []),
    after,
    ...(ref ? [ref] : []),
  ];
}

await Promise.all(scenes.map(async (scene) => {
  const cols = [...(args.before ? ['before'] : []), 'after', ...(withRef ? ['1:25k'] : [])];
  const W = PANEL.w * cols.length + 4 * (cols.length - 1);
  const rows = await Promise.all(zooms.map((z) => panelsFor(scene, z)));
  const composites = [{ input: label(`${scene} — ${SCENES[scene].note} — ${cols.join(' | ')}`, W), left: 0, top: 0 }];
  rows.forEach((panels, row) => {
    const top = 22 + row * (PANEL.h + 4);
    // The 1:25k raster stops at z9; OL upsamples it beyond that
    panels.forEach((input, i) => composites.push({ input, left: i * (PANEL.w + 4), top }));
    composites.push({ input: label(`z${zooms[row]}`, 40), left: 0, top: top + PANEL.h - 22 });
  });
  const H = 22 + zooms.length * (PANEL.h + 4);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#333' } })
    .composite(composites).png().toFile(path.join(out, `sheet-${scene}.png`));
  console.log(`${scene}: ${path.join(out, `sheet-${scene}.png`)}`);
}));

await Promise.all(browsers.map((b) => b.close()));
