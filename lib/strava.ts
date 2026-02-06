import { ActivityData } from './types';

// Mock data for development/testing
// Replace with actual Strava API calls
export async function getActivityData(activityId: string): Promise<ActivityData> {
  // Example route: A loop around Buttermere in the Lake District
  const mockRoute: [number, number][] = [
    [54.5416, -3.2780],
    [54.5430, -3.2755],
    [54.5445, -3.2730],
    [54.5460, -3.2700],
    [54.5475, -3.2670],
    [54.5490, -3.2650],
    [54.5505, -3.2625],
    [54.5515, -3.2600],
    [54.5520, -3.2570],
    [54.5510, -3.2545],
    [54.5495, -3.2530],
    [54.5475, -3.2520],
    [54.5455, -3.2525],
    [54.5435, -3.2540],
    [54.5420, -3.2560],
    [54.5410, -3.2590],
    [54.5405, -3.2625],
    [54.5400, -3.2660],
    [54.5398, -3.2700],
    [54.5400, -3.2735],
    [54.5405, -3.2760],
    [54.5416, -3.2780],
  ];

  return {
    id: activityId,
    name: 'Buttermere Horseshoe',
    route: mockRoute,
    photos: [
      {
        id: 'photo1',
        url: 'https://picsum.photos/200/200?random=1',
        lat: 54.5505,
        lng: -3.2625,
        caption: 'Summit views',
      },
      {
        id: 'photo2',
        url: 'https://picsum.photos/200/200?random=2',
        lat: 54.5455,
        lng: -3.2525,
        caption: 'Looking back at Buttermere',
      },
    ],
    stats: {
      distance: 12450,
      movingTime: 5400,
      elevationGain: 820,
      averageSpeed: 2.3,
      maxSpeed: 3.8,
      startDate: new Date().toISOString(),
    },
  };
}
