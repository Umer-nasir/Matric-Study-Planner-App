export type TimeGreeting =
  | 'Good morning'
  | 'Good afternoon'
  | 'Good evening'
  | 'Good night';

export function getTimeGreeting(now = new Date()): TimeGreeting {
  const hour = now.getHours();

  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 19) return 'Good evening';
  return 'Good night';
}
