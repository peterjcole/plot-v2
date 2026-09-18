'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Shared route-drawing chrome — the SVG glow outline, direction chevrons and
// start/end markers ActivityMap uses for a finished route. BeaconMap reuses
// these unchanged for its live trail, rather than drawing its own plainer
// version, so a beacon's "actual path so far" reads exactly like any other
// route in the app.

export function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function sampleArrowIndices(
  route: [number, number][],
  intervalMeters = 1000,
  maxArrows = 20
): number[] {
  if (route.length < 2) return [];

  const cumDist: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cumDist.push(cumDist[i - 1] + L.latLng(route[i - 1]).distanceTo(L.latLng(route[i])));
  }
  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist < 500) return [];

  const skip = Math.floor(route.length * 0.05);
  const indices: number[] = [];
  let nextTarget = intervalMeters;

  for (let i = skip; i < route.length - skip; i++) {
    if (cumDist[i] >= nextTarget) {
      indices.push(i);
      nextTarget += intervalMeters;
      if (indices.length >= maxArrows) break;
    }
  }
  return indices;
}

export function RouteOutlineFilter({ strokeColor, outlineColor }: { strokeColor: string; outlineColor: string }) {
  const map = useMap();

  useEffect(() => {
    const apply = () => {
      const svg = map.getContainer().querySelector('svg');
      if (!svg) return;

      const paths = svg.querySelectorAll('path.leaflet-interactive');
      const routePath = Array.from(paths).find(
        (p) => p.getAttribute('stroke') === strokeColor
      );
      if (!routePath) return;

      let defs = svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
      }

      if (!defs.querySelector('#route-outline')) {
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'route-outline');
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-20%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '140%');
        filter.innerHTML = [
          '<feComponentTransfer in="SourceAlpha" result="opaque-alpha">',
          '  <feFuncA type="linear" slope="100" intercept="0"/>',
          '</feComponentTransfer>',
          '<feMorphology in="opaque-alpha" operator="dilate" radius="2" result="dilated"/>',
          `<feFlood flood-color="${outlineColor}" flood-opacity="1.0" result="color"/>`,
          '<feComposite in="color" in2="dilated" operator="in" result="full-outline"/>',
          '<feComposite in="full-outline" in2="opaque-alpha" operator="out" result="border-only"/>',
          '<feMerge>',
          '  <feMergeNode in="border-only"/>',
          '  <feMergeNode in="SourceGraphic"/>',
          '</feMerge>',
        ].join('');
        defs.appendChild(filter);
      }

      routePath.setAttribute('filter', 'url(#route-outline)');
    };

    // Apply after initial render and reapply on zoom/pan (Leaflet recreates SVG paths)
    const timer = setTimeout(apply, 500);
    map.on('moveend', apply);

    return () => {
      clearTimeout(timer);
      map.off('moveend', apply);
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps -- filter created once per map; colors are static for a given render

  return null;
}

interface StartEndMarkersProps {
  route: [number, number][];
  color: string;
  /** Beacon's live trail: the last point is "current position", not a
   * finish — the checkered flag only belongs there once the workout has
   * actually ended. ActivityMap (a finished route) always wants it. */
  showEnd?: boolean;
}

export function StartEndMarkers({ route, color, showEnd = true }: StartEndMarkersProps) {
  const map = useMap();

  useEffect(() => {
    if (route.length === 0) return;

    const startIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:20px;height:20px;border-radius:50%;
        background:${color};
        border:3px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,0.45);
        box-sizing:border-box;
        opacity:0.75;
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const startMarker = L.marker(route[0], { icon: startIcon, interactive: false, zIndexOffset: 1000 });
    startMarker.addTo(map);

    let endMarker: L.Marker | null = null;
    if (showEnd) {
      const endIcon = L.divIcon({
        className: '',
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:block"><defs><clipPath id="end-checker-clip"><circle cx="10" cy="10" r="8"/></clipPath></defs><g clip-path="url(#end-checker-clip)"><rect x="2" y="2" width="8" height="8" fill="${color}"/><rect x="10" y="2" width="8" height="8" fill="white"/><rect x="2" y="10" width="8" height="8" fill="white"/><rect x="10" y="10" width="8" height="8" fill="${color}"/></g><circle cx="10" cy="10" r="8" fill="none" stroke="white" stroke-width="2.5"/></svg>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      endMarker = L.marker(route[route.length - 1], { icon: endIcon, interactive: false, zIndexOffset: 0 });
      endMarker.addTo(map);
    }

    return () => {
      startMarker.remove();
      endMarker?.remove();
    };
  }, [map, route, color, showEnd]);

  return null;
}

export function DirectionArrows({ route, color, opacity = 1 }: { route: [number, number][]; color: string; opacity?: number }) {
  const map = useMap();

  useEffect(() => {
    const indices = sampleArrowIndices(route, 2000);
    if (indices.length === 0) return;

    const markers = indices.map((idx) => {
      const ahead = Math.min(idx + 5, route.length - 1);
      const deg = bearing(route[idx][0], route[idx][1], route[ahead][0], route[ahead][1]);
      const icon = L.divIcon({
        className: '',
        html: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" style="display:block;transform:rotate(${deg}deg);opacity:${opacity}"><path d="M18 15 L12 9 L6 15" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      return L.marker(route[idx], { icon, interactive: false }).addTo(map);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, route, color, opacity]);

  return null;
}
