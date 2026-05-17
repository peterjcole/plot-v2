import { haversineDistance } from './elevation';

function jitteredCut(targetMeters: number, jitterFraction: number): number {
  const lo = targetMeters * (1 - jitterFraction);
  const hi = targetMeters * (1 + jitterFraction);
  return lo + Math.random() * (hi - lo);
}

function interpolate(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function trimRouteEnds(
  route: [number, number][],
  targetMeters: number,
  jitterFraction = 0.2,
): [number, number][] {
  if (route.length < 2) return [];

  const startCut = jitteredCut(targetMeters, jitterFraction);
  const endCut = jitteredCut(targetMeters, jitterFraction);

  // Walk from start to find cut point
  let cumulative = 0;
  let startIdx = -1;
  let startPoint: [number, number] | null = null;

  for (let i = 1; i < route.length; i++) {
    const segLen = haversineDistance(
      { lat: route[i - 1][0], lng: route[i - 1][1] },
      { lat: route[i][0], lng: route[i][1] },
    );
    if (cumulative + segLen >= startCut) {
      const t = (startCut - cumulative) / segLen;
      startPoint = interpolate(route[i - 1], route[i], t);
      startIdx = i;
      break;
    }
    cumulative += segLen;
  }

  // Walk from end to find cut point
  cumulative = 0;
  let endIdx = -1;
  let endPoint: [number, number] | null = null;

  for (let i = route.length - 2; i >= 0; i--) {
    const segLen = haversineDistance(
      { lat: route[i][0], lng: route[i][1] },
      { lat: route[i + 1][0], lng: route[i + 1][1] },
    );
    if (cumulative + segLen >= endCut) {
      const t = (endCut - cumulative) / segLen;
      endPoint = interpolate(route[i + 1], route[i], t);
      endIdx = i;
      break;
    }
    cumulative += segLen;
  }

  // Either cut walked past the other — nothing left to show
  if (startPoint === null || endPoint === null || startIdx > endIdx) return [];

  return [startPoint, ...route.slice(startIdx, endIdx + 1), endPoint];
}
