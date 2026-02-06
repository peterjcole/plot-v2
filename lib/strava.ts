import { ActivityData } from './types';

// Mock data for development/testing
// Replace with actual Strava API calls
export async function getActivityData(activityId: string): Promise<ActivityData> {
  // Example route: A loop in San Francisco
  const mockRoute: [number, number][] = [
    [37.7749, -122.4194],
    [37.7751, -122.4180],
    [37.7760, -122.4170],
    [37.7775, -122.4165],
    [37.7790, -122.4170],
    [37.7800, -122.4185],
    [37.7795, -122.4200],
    [37.7780, -122.4210],
    [37.7765, -122.4205],
    [37.7749, -122.4194],
  ];

  return {
    id: activityId,
    name: 'Morning Run in San Francisco',
    route: mockRoute,
    photos: [
      {
        id: 'photo1',
        url: 'https://picsum.photos/200/200?random=1',
        lat: 37.7775,
        lng: -122.4165,
        caption: 'Halfway point',
      },
      {
        id: 'photo2',
        url: 'https://picsum.photos/200/200?random=2',
        lat: 37.7800,
        lng: -122.4185,
        caption: 'Great view!',
      },
    ],
    stats: {
      distance: 5230,
      movingTime: 1800,
      elevationGain: 45,
      averageSpeed: 2.9,
      maxSpeed: 4.2,
      startDate: new Date().toISOString(),
    },
  };
}
