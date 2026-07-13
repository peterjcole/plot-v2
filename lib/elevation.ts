export interface ElevationPoint {
  distance: number; // cumulative distance in meters
  ele: number;
  lat: number;
  lng: number;
}

export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function smoothElevation<T extends { ele: number }>(
  points: T[],
  windowSize: number
): T[] {
  if (points.length < windowSize * 2) return points;
  const half = Math.floor(windowSize / 2);
  return points.map((pt, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(points.length - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += points[j].ele;
    return { ...pt, ele: sum / (end - start + 1) };
  });
}

/** Total ascent (meters): sum of positive elevation deltas between consecutive points. */
export function elevationGain(points: { ele: number }[]): number {
  if (points.length < 2) return 0;
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].ele - points[i - 1].ele;
    if (delta > 0) gain += delta;
  }
  return Math.round(gain);
}

export function downsampleToChartPoints(
  points: ElevationPoint[],
  max = 200
): ElevationPoint[] {
  const step = points.length > max ? points.length / max : 1;
  const result: ElevationPoint[] = [];
  for (let k = 0; k < points.length; k = Math.round(k + step)) {
    result.push(points[k]);
  }
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}
