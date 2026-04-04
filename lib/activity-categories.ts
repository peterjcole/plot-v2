/** Map Strava activity types to the three UI display categories. */
export type ActivityCategory = 'run' | 'hike' | 'cycle' | 'other';

export function getActivityCategory(type: string): ActivityCategory {
  const t = type.toLowerCase();
  if (t.includes('run')) return 'run';
  if (t.includes('hike') || t.includes('walk')) return 'hike';
  if (t.includes('ride') || t.includes('bike') || t.includes('cycl')) return 'cycle';
  return 'other';
}

/** Design-token colours matching the mockup-h palette. */
export function getCategoryColor(category: ActivityCategory): string {
  switch (category) {
    case 'run': return '#E07020';   // --ora
    case 'hike': return '#40B060';  // --grn
    case 'cycle': return '#4080C0'; // --blu
    default: return '#2A5860';      // --p4
  }
}

export function getActivityColor(type: string): string {
  return getCategoryColor(getActivityCategory(type));
}
