import type { ActivityData } from '@/lib/types';
import { fmtKm, fmtElev, fmtTime, fmtPace, fmtDate } from '@/lib/format-stats';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Max chars before name is truncated (SVG has no auto text-overflow)
const MAX_NAME_CHARS = 38;
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// IBM Plex Mono advance width per character at a given font size.
// Monospace: every character has the same advance. Measured at 1000 units/em,
// the advance is ~600 units, so char_width = font_size * 0.6.
function monoCharWidth(fontSize: number) { return fontSize * 0.6; }

interface StatDef {
  label: string;
  value: string;
  // unit rendered as a <tspan> continuation directly after the value text.
  // Value + unit share one <text> element so the engine handles sequential placement.
  unit?: string;
  noBorderRight?: boolean;
}

/**
 * Builds an SVG string for the wallpaper HUD panel (bottom-left overlay).
 * Text uses IBM Plex Mono (stats) and Ribeye Marrow (wordmark).
 * Both fonts must be available to librsvg via fontconfig — see route.ts setup.
 */
export function buildWallpaperHud(
  activity: ActivityData,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const { stats } = activity;

  const stats_: StatDef[] = [
    { label: 'Distance', value: fmtKm(stats.distance), unit: ' km' },
    // ↑ is U+2191 (UPWARDS ARROW) — present in IBM Plex Mono
    { label: 'Elevation', value: fmtElev(stats.elevationGain), unit: ' ↑m' },
    { label: 'Time',      value: fmtTime(stats.movingTime) },
    { label: 'Pace',      value: fmtPace(stats.distance, stats.movingTime), unit: ' /km', noBorderRight: true },
  ];

  // ── Panel geometry ──────────────────────────────────────────────────────────
  // 270px per block gives comfortable room for the longest value "1:33:03" at
  // 56px IBM Plex Mono Bold (7 chars × ~34px/char ≈ 238px + 28px left pad = 266px).
  const BLOCK_W   = 270;
  const PAD_H     = 28;   // horizontal padding inside each block
  const PANEL_W   = BLOCK_W * 4;

  const ACCENT_H  = 3;
  const HDR_PAD_T = 20;   // top padding before wordmark
  const WORDMARK_SIZE = 36;
  const NAME_SIZE     = 22;
  const HDR_PAD_B = 10;
  const HDR_H     = HDR_PAD_T + WORDMARK_SIZE + HDR_PAD_B;

  const SUB_H     = 38;   // type · date row
  const DIV_H     = 1;
  const BLOCK_H   = 120;  // stat blocks
  const FOOTER_H  = 32;

  const PANEL_H   = ACCENT_H + HDR_H + SUB_H + DIV_H + BLOCK_H + DIV_H + FOOTER_H;

  const panelX    = 60;
  const panelY    = canvasHeight - 60 - PANEL_H;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, sw = 1) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;

  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, sw = 1) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;

  // ── Build elements ──────────────────────────────────────────────────────────
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">`,

    // Panel background + border
    rect(panelX, panelY, PANEL_W, PANEL_H, 'rgba(14,40,48,0.88)', 'rgba(30,72,88,0.85)'),

    // Orange accent stripe
    rect(panelX, panelY, PANEL_W, ACCENT_H, '#E07020'),
  ];

  // ── Header: wordmark | activity name ────────────────────────────────────────
  const hdrBaseline = panelY + ACCENT_H + HDR_PAD_T + WORDMARK_SIZE;

  // "plot" wordmark in Ribeye Marrow
  parts.push(
    `<text x="${panelX + PAD_H}" y="${hdrBaseline}" ` +
    `font-family="Ribeye Marrow" font-size="${WORDMARK_SIZE}" fill="#E07020" ` +
    `letter-spacing="1.8">${escapeXml('plot')}</text>`,
  );

  // Vertical divider — estimate wordmark width: 4 chars × monoCharWidth would
  // be wrong (Ribeye Marrow is proportional). Estimate ~90px for "plot" at 36px.
  const WORDMARK_W = 90;
  const divX = panelX + PAD_H + WORDMARK_W + 14;
  parts.push(line(divX, hdrBaseline - WORDMARK_SIZE + 4, divX, hdrBaseline, 'rgba(30,72,88,0.8)'));

  // Activity name in IBM Plex Mono Bold
  const nameText = truncate(activity.name ?? '', MAX_NAME_CHARS);
  // Clip name so it doesn't overflow the panel right edge
  const nameMaxW = PANEL_W - (divX - panelX) - 16 - PAD_H;
  parts.push(
    `<text x="${divX + 16}" y="${hdrBaseline}" ` +
    `font-family="IBM Plex Mono" font-size="${NAME_SIZE}" font-weight="700" fill="#F0F8FA" ` +
    `letter-spacing="0.22" textLength="${nameMaxW}" lengthAdjust="spacingAndGlyphs">` +
    `${escapeXml(nameText)}</text>`,
  );

  // ── Sub-header: TYPE · date ──────────────────────────────────────────────────
  let curY = panelY + ACCENT_H + HDR_H;
  const subBaseline = curY + 18;

  let subParts = '';
  if (activity.type) {
    subParts +=
      `<tspan font-family="IBM Plex Mono" font-size="11" font-weight="700" ` +
      `fill="#E07020" letter-spacing="2">${escapeXml(activity.type.toUpperCase())}</tspan>`;
  }
  if (activity.type && stats.startDate) {
    subParts += `<tspan font-size="11" fill="rgba(240,248,250,0.35)"> · </tspan>`;
  }
  if (stats.startDate) {
    subParts +=
      `<tspan font-family="IBM Plex Mono" font-size="11" font-weight="400" ` +
      `fill="rgba(240,248,250,0.65)" letter-spacing="0.44">${escapeXml(fmtDate(stats.startDate))}</tspan>`;
  }
  if (subParts) {
    parts.push(`<text x="${panelX + PAD_H}" y="${subBaseline}">${subParts}</text>`);
  }

  curY += SUB_H;

  // ── Divider ──────────────────────────────────────────────────────────────────
  parts.push(line(panelX, curY, panelX + PANEL_W, curY, 'rgba(30,72,88,0.6)'));
  curY += DIV_H;

  // ── Stat blocks ──────────────────────────────────────────────────────────────
  const LABEL_SIZE   = 10;
  const VALUE_SIZE   = 56;
  const UNIT_SIZE    = 16;
  const LABEL_PAD_T  = 20;
  const LABEL_LETTER = 1.5;

  stats_.forEach((b, i) => {
    const bx = panelX + i * BLOCK_W;
    const by = curY;

    // Right border
    if (!b.noBorderRight) {
      parts.push(line(bx + BLOCK_W, by, bx + BLOCK_W, by + BLOCK_H, 'rgba(30,72,88,0.6)'));
    }

    // Label
    const labelY = by + LABEL_PAD_T + LABEL_SIZE;
    parts.push(
      `<text x="${bx + PAD_H}" y="${labelY}" ` +
      `font-family="IBM Plex Mono" font-size="${LABEL_SIZE}" font-weight="400" ` +
      `fill="rgba(240,248,250,0.5)" letter-spacing="${LABEL_LETTER}">` +
      `${escapeXml(b.label.toUpperCase())}</text>`,
    );

    // Value + unit in one <text> element.
    // The unit <tspan> continues directly from where the value text ends —
    // the SVG engine handles the sequential X placement, no width math needed.
    const valueY = labelY + 8 + VALUE_SIZE; // 8px gap between label and value baseline
    const unitDy = -(VALUE_SIZE - UNIT_SIZE - 4); // raise unit to sit above value baseline

    let valueContent =
      `<tspan font-family="IBM Plex Mono" font-size="${VALUE_SIZE}" font-weight="700" ` +
      `fill="#F0F8FA" letter-spacing="-0.56">${escapeXml(b.value)}</tspan>`;

    if (b.unit) {
      valueContent +=
        `<tspan font-family="IBM Plex Mono" font-size="${UNIT_SIZE}" font-weight="400" ` +
        `fill="rgba(240,248,250,0.7)" dy="${unitDy}">${escapeXml(b.unit)}</tspan>`;
    }

    parts.push(`<text x="${bx + PAD_H}" y="${valueY}">${valueContent}</text>`);
  });

  curY += BLOCK_H;

  // ── Divider ──────────────────────────────────────────────────────────────────
  parts.push(line(panelX, curY, panelX + PANEL_W, curY, 'rgba(30,72,88,0.4)'));
  curY += DIV_H;

  // ── Footer ────────────────────────────────────────────────────────────────────
  parts.push(
    `<text x="${panelX + PAD_H}" y="${curY + 20}" ` +
    `font-family="IBM Plex Mono" font-size="9" font-weight="400" ` +
    `fill="rgba(240,248,250,0.22)" letter-spacing="0.36">© Crown copyright · Ordnance Survey</text>`,
  );

  parts.push(`</svg>`);
  return parts.join('\n');
}
