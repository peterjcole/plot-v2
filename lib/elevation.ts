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

/**
 * How many samples `smoothElevation`'s window should span to cover
 * `targetMeters` of actual ground, given the average spacing between
 * points. A plain `points.length / N` fraction (the previous approach)
 * scales the *ground* window with route length and point density instead
 * of holding it fixed — a 20km route with dense waypoints got a ~390m
 * window, flattening every climb shorter than that (see the 2026-09
 * elevation-mismatch investigation, DESIGN.md). Minimum of 5 guards
 * against a near-empty window on a very sparse or very short route.
 */
export function distanceWindowSize(
  pointCount: number,
  totalDistanceMeters: number,
  targetMeters: number
): number {
  if (pointCount < 2 || totalDistanceMeters <= 0) return 5;
  const avgSpacing = totalDistanceMeters / (pointCount - 1);
  return Math.max(5, Math.round(targetMeters / avgSpacing));
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

/** Ground distance per bin, and the pullback needed to confirm a peak or
 * valley as real rather than noise. Same algorithm and same constants as
 * PlotCore's `ElevationGain` (plot-ios) — applied there to a recorded
 * workout's raw GPS altitude, applied here to a route's DEM-sampled
 * elevation — so a route's quoted ascent and a recording of it read the
 * same way. Tuned in the 2026-09 elevation-mismatch investigation:
 * distance-binning (not per-sample) is what makes a DEM-sampled route and
 * a 1Hz GPS recording comparable in the first place, and a 5m pullback to
 * confirm a turning point rejects DEM/GPS noise without erasing real
 * climbs — see DESIGN.md for the cross-checks (Strava's own total, an
 * independent DEM sample) that landed on these numbers. */
const ELEVATION_GAIN_BIN_METERS = 40;
const ELEVATION_GAIN_THRESHOLD_METERS = 5;

/**
 * Total ascent (meters): points are binned by ground distance travelled
 * (one altitude — the median of whatever fell in the bin — per
 * `ELEVATION_GAIN_BIN_METERS`), then accumulated peak-to-valley: a climb
 * only banks once the signal has pulled back `ELEVATION_GAIN_THRESHOLD_METERS`
 * from its high, confirming that high as a real peak rather than noise,
 * and the next climb is measured from the low it pulled back to. Unlike a
 * plain positive-delta sum, a small dip mid-climb costs nothing — it only
 * splits the climb in two if the pullback is real.
 */
export function elevationGain(points: { ele: number; distance: number }[]): number {
  if (points.length < 2) return 0;

  let direction: 'rising' | 'falling' = 'rising';
  let runningExtreme: number | null = null;
  let lastConfirmed: number | null = null;
  let banked = 0;

  const feed = (altitude: number) => {
    if (runningExtreme === null || lastConfirmed === null) {
      runningExtreme = altitude;
      lastConfirmed = altitude;
      return;
    }
    if (direction === 'rising') {
      if (altitude >= runningExtreme) {
        runningExtreme = altitude;
      } else if (runningExtreme - altitude >= ELEVATION_GAIN_THRESHOLD_METERS) {
        banked += runningExtreme - lastConfirmed;
        lastConfirmed = altitude;
        direction = 'falling';
        runningExtreme = altitude;
      }
    } else {
      if (altitude <= runningExtreme) {
        runningExtreme = altitude;
      } else if (altitude - runningExtreme >= ELEVATION_GAIN_THRESHOLD_METERS) {
        lastConfirmed = runningExtreme;
        direction = 'rising';
        runningExtreme = altitude;
      }
    }
  };

  const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  let binStart: number | null = null;
  let pending: number[] = [];
  for (const p of points) {
    if (binStart === null) {
      binStart = p.distance;
      pending = [p.ele];
      continue;
    }
    if (p.distance - binStart >= ELEVATION_GAIN_BIN_METERS) {
      feed(median(pending));
      binStart = p.distance;
      pending = [p.ele];
    } else {
      pending.push(p.ele);
    }
  }
  if (pending.length > 0) feed(median(pending));

  // A climb still in progress when the data ends counts too — same as
  // dropping the last, not-yet-confirmed leg would otherwise lose it.
  if (direction === 'rising' && runningExtreme !== null && lastConfirmed !== null) {
    banked += Math.max(0, runningExtreme - lastConfirmed);
  }

  return Math.round(banked);
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
