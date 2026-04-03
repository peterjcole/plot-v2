export interface ActivityPhoto {
  id: string;
  url: string;
  lat: number;
  lng: number;
  caption?: string;
}

export interface ActivityStats {
  distance: number; // in meters
  movingTime: number; // in seconds
  elevationGain: number; // in meters
  averageSpeed: number; // in m/s
  maxSpeed: number; // in m/s
  startDate: string; // ISO date string
}

export interface ActivityData {
  id: string;
  name: string;
  description?: string;
  route: [number, number][]; // [lat, lng][]
  photos: ActivityPhoto[];
  stats: ActivityStats;
}

export interface ActivitySummary {
  id: number;
  name: string;
  type: string;
  startDate: string;
  distance: number; // in meters
  movingTime: number; // in seconds
  elevationGain: number; // in meters
  photoCount: number;
  route?: [number, number][]; // [lat, lng][] decoded from summary_polyline
}

export interface HeatmapActivity {
  id: number;
  name: string;
  sportType: string | null;
  startDate: string;
  distance: number | null;
  movingTime: number | null;
  route: [number, number][]; // [lng, lat][] GeoJSON order
}

export interface PhotoItem {
  photoId: string;
  url: string;
  lat: number;
  lng: number;
  activityId: number;
  activityName: string;
  activityDate: string;
  activityDistance: number | null;
  sportType: string | null;
}

export interface Waypoint {
  lat: number;
  lng: number;
  ele?: number;
}

export interface RouteSegment {
  snapped: boolean;
  coordinates: Waypoint[];
  distance?: number;
}

declare global {
  interface Window {
    __MAP_READY__?: boolean;
  }
}
