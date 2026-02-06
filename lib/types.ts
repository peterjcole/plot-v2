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
  route: [number, number][]; // [lat, lng][]
  photos: ActivityPhoto[];
  stats: ActivityStats;
}

declare global {
  interface Window {
    __MAP_READY__?: boolean;
  }
}
