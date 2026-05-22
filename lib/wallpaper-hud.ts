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

const MAX_NAME_CHARS = 38;
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

interface StatDef {
  label: string;
  value: string;
  unit?: string;
  // Per-block width sized to fit the maximum expected value at 56px IBM Plex Mono Bold
  // (monospace: ~33.6px/char) + 28px left pad + headroom for unit tspan overflow.
  // Mirrors the flex-shrink behaviour of the original React component.
  width: number;
  noBorderRight?: boolean;
}

/**
 * Builds an SVG string for the wallpaper HUD panel (bottom-left overlay).
 * Text uses IBM Plex Mono (stats) and Ribeye Marrow (wordmark).
 * Both fonts must be available to librsvg via fontconfig — see wallpaper route.ts.
 */
export function buildWallpaperHud(
  activity: ActivityData,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const { stats } = activity;

  // Block widths are sized for the longest plausible value at 56px mono (33.6px/char):
  //   distance  max "999.99"  = 6ch × 33.6 = 202px + 28px pad → 240
  //   elevation max "9999"    = 4ch × 33.6 = 134px + 28px pad → 175 (unit overflows into Time's left pad, fine)
  //   time      max "99:59:59"= 8ch × 33.6 = 269px + 28px pad → 310 (no unit)
  //   pace      max "99:59"   = 5ch × 33.6 = 168px + 28px pad → 210 (unit "/km" overflows into panel edge, last block)
  const statDefs: StatDef[] = [
    { label: 'Distance',  value: fmtKm(stats.distance),                     unit: ' km',  width: 240 },
    { label: 'Elevation', value: fmtElev(stats.elevationGain),              unit: ' ↑m',  width: 175 },
    { label: 'Time',      value: fmtTime(stats.movingTime),                              width: 310 },
    { label: 'Pace',      value: fmtPace(stats.distance, stats.movingTime), unit: ' /km', width: 210, noBorderRight: true },
  ];

  // ── Panel geometry ──────────────────────────────────────────────────────────
  const PAD_H      = 28;
  const PANEL_W    = statDefs.reduce((sum, b) => sum + b.width, 0); // 935px

  const ACCENT_H   = 3;
  const HDR_PAD_T  = 20;
  const WORDMARK_SIZE = 36;
  const HDR_PAD_B  = 10;
  const HDR_H      = HDR_PAD_T + WORDMARK_SIZE + HDR_PAD_B;

  const SUB_H      = 38;
  const DIV_H      = 1;
  const BLOCK_H    = 120;
  const FOOTER_H   = 32;

  const PANEL_H    = ACCENT_H + HDR_H + SUB_H + DIV_H + BLOCK_H + DIV_H + FOOTER_H;

  const panelX     = 60;
  const panelY     = canvasHeight - 60 - PANEL_H;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const ln = (x1: number, y1: number, x2: number, y2: number, stroke: string, sw = 1) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;

  const rc = (x: number, y: number, w: number, h: number, fill: string, stroke?: string, sw = 1) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;

  // ── Build elements ──────────────────────────────────────────────────────────
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">`,

    rc(panelX, panelY, PANEL_W, PANEL_H, 'rgba(14,40,48,0.88)', 'rgba(30,72,88,0.85)'),
    rc(panelX, panelY, PANEL_W, ACCENT_H, '#E07020'),
  ];

  // ── Header: wordmark | activity name ────────────────────────────────────────
  const hdrBaseline = panelY + ACCENT_H + HDR_PAD_T + WORDMARK_SIZE;

  parts.push(
    `<text x="${panelX + PAD_H}" y="${hdrBaseline}" ` +
    `font-family="Ribeye Marrow" font-size="${WORDMARK_SIZE}" fill="#E07020" ` +
    `letter-spacing="1.8">plot</text>`,
  );

  // Vertical divider after wordmark. "plot" at 36px Ribeye Marrow is approximately
  // 88px wide (4 chars, proportional serif — estimated, not measured).
  const divX = panelX + PAD_H + 88 + 14;
  parts.push(ln(divX, hdrBaseline - WORDMARK_SIZE + 4, divX, hdrBaseline, 'rgba(30,72,88,0.8)'));

  const nameText = truncate(activity.name ?? '', MAX_NAME_CHARS);
  parts.push(
    `<text x="${divX + 16}" y="${hdrBaseline}" ` +
    `font-family="IBM Plex Mono" font-size="22" font-weight="700" fill="#F0F8FA" ` +
    `letter-spacing="0.22">${escapeXml(nameText)}</text>`,
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
  parts.push(ln(panelX, curY, panelX + PANEL_W, curY, 'rgba(30,72,88,0.6)'));
  curY += DIV_H;

  // ── Stat blocks ──────────────────────────────────────────────────────────────
  const LABEL_SIZE  = 10;
  const VALUE_SIZE  = 56;
  const UNIT_SIZE   = 16;
  const LABEL_PAD_T = 20;

  let bx = panelX;
  for (const b of statDefs) {
    const by = curY;

    if (!b.noBorderRight) {
      parts.push(ln(bx + b.width, by, bx + b.width, by + BLOCK_H, 'rgba(30,72,88,0.6)'));
    }

    // Label
    const labelY = by + LABEL_PAD_T + LABEL_SIZE;
    parts.push(
      `<text x="${bx + PAD_H}" y="${labelY}" ` +
      `font-family="IBM Plex Mono" font-size="${LABEL_SIZE}" font-weight="400" ` +
      `fill="rgba(240,248,250,0.5)" letter-spacing="1.5">${escapeXml(b.label.toUpperCase())}</text>`,
    );

    // Value + unit in one <text> element.
    // Unit <tspan> starts at the current text position after the value — the SVG
    // engine handles sequential placement, no manual width calculation needed.
    const valueY = labelY + 8 + VALUE_SIZE;

    let valueContent =
      `<tspan font-family="IBM Plex Mono" font-size="${VALUE_SIZE}" font-weight="700" ` +
      `fill="#F0F8FA" letter-spacing="-0.56">${escapeXml(b.value)}</tspan>`;

    if (b.unit) {
      // No dy: both value and unit share the same baseline (matches React alignItems:'baseline')
      valueContent +=
        `<tspan font-family="IBM Plex Mono" font-size="${UNIT_SIZE}" font-weight="400" ` +
        `fill="rgba(240,248,250,0.7)">${escapeXml(b.unit)}</tspan>`;
    }

    parts.push(`<text x="${bx + PAD_H}" y="${valueY}">${valueContent}</text>`);

    bx += b.width;
  }

  curY += BLOCK_H;

  parts.push(ln(panelX, curY, panelX + PANEL_W, curY, 'rgba(30,72,88,0.4)'));
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
