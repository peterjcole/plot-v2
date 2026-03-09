export type ExportMode = 'explorer' | 'landranger' | 'satellite';

// EPSG:27700 resolutions (meters/pixel) indexed by zoom level 0–9
const OS_RESOLUTIONS = [896, 448, 224, 112, 56, 28, 14, 7, 3.5, 1.75];

const MAX_PX = 10_000;
const MIN_W = 800;
const MIN_H = 600;

export function getExportRenderZoom(exportMode: ExportMode): number {
  return exportMode === 'landranger' ? 7 : 9;
}

export function calculateRenderDimensions(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  exportMode: ExportMode,
  maxTotalPixels?: number
): { width: number; height: number; renderZoom: number } {
  const { minLat, maxLat, minLng, maxLng } = bbox;
  const avgLat = (maxLat + minLat) / 2;
  const avgLatRad = (avgLat * Math.PI) / 180;
  const widthM = (maxLng - minLng) * 111320 * Math.cos(avgLatRad);
  const heightM = (maxLat - minLat) * 111320;

  if (exportMode === 'landranger') {
    let renderZoom = 7;
    while (renderZoom > 0) {
      const res = OS_RESOLUTIONS[renderZoom];
      const rawW = (widthM * 1.2) / res;
      const rawH = (heightM * 1.2) / res;
      const scale = Math.min(1, MAX_PX / Math.max(rawW, rawH));
      const w = Math.max(Math.round(rawW * scale), MIN_W);
      const h = Math.max(Math.round(rawH * scale), MIN_H);
      if (!maxTotalPixels || w * h <= maxTotalPixels) break;
      renderZoom--;
    }
    const res = OS_RESOLUTIONS[renderZoom];
    const rawW = (widthM * 1.2) / res;
    const rawH = (heightM * 1.2) / res;
    const scale = Math.min(1, MAX_PX / Math.max(rawW, rawH));
    return {
      width: Math.max(Math.round(rawW * scale), MIN_W),
      height: Math.max(Math.round(rawH * scale), MIN_H),
      renderZoom,
    };
  }

  if (exportMode === 'explorer') {
    let renderZoom = 9;
    while (renderZoom > 0) {
      const res = OS_RESOLUTIONS[renderZoom];
      const w = Math.max(Math.round((widthM * 1.2) / res), MIN_W);
      const h = Math.max(Math.round((heightM * 1.2) / res), MIN_H);
      if (w <= MAX_PX && h <= MAX_PX && (!maxTotalPixels || w * h <= maxTotalPixels)) break;
      renderZoom--;
    }
    const res = OS_RESOLUTIONS[renderZoom];
    return {
      width: Math.max(Math.round((widthM * 1.2) / res), MIN_W),
      height: Math.max(Math.round((heightM * 1.2) / res), MIN_H),
      renderZoom,
    };
  }

  // satellite — Web Mercator pixel size at center latitude
  const circumference = 40_075_016.686;
  let renderZoom = 18;
  while (renderZoom > 0) {
    const res =
      (circumference * Math.cos(avgLatRad)) / (256 * Math.pow(2, renderZoom));
    const w = Math.max(Math.round((widthM * 1.2) / res), MIN_W);
    const h = Math.max(Math.round((heightM * 1.2) / res), MIN_H);
    if (w <= MAX_PX && h <= MAX_PX && (!maxTotalPixels || w * h <= maxTotalPixels)) break;
    renderZoom--;
  }
  const res =
    (circumference * Math.cos(avgLatRad)) / (256 * Math.pow(2, renderZoom));
  return {
    width: Math.max(Math.round((widthM * 1.2) / res), MIN_W),
    height: Math.max(Math.round((heightM * 1.2) / res), MIN_H),
    renderZoom,
  };
}
