/**
 * Earthy, muted sport colors — designed to complement the OS-map-inspired
 * primary (#4A5A2B) and accent (#D4872B) palette.
 */
export const SPORT_COLORS: Record<string, string> = {
  Run:                '#B5451B', // terracotta
  TrailRun:           '#8B3318', // burnt sienna
  Ride:               '#2D5F82', // slate blue
  GravelRide:         '#2A6870', // dusty teal
  MountainBikeRide:   '#2A5C28', // forest green
  VirtualRide:        '#5C4E80', // dusty plum
  Walk:               '#5C7838', // warm olive
  Hike:               '#7A5030', // umber
  Swim:               '#186870', // deep teal
  AlpineSki:          '#2E5478', // muted alpine blue
  NordicSki:          '#3A5268', // slate
};

export const DEFAULT_SPORT_COLOR = '#6B6050'; // warm neutral brown

export function getSportColor(sportType: string | null | undefined): string {
  return SPORT_COLORS[sportType ?? ''] ?? DEFAULT_SPORT_COLOR;
}

/** Returns an rgba() string from a 6-digit hex color and an alpha value. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
