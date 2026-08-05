export const QUOTES: string[] = [
  'The expert in anything was once a beginner.',
  'Small daily improvements lead to stunning results.',
  'Your only competition is who you were yesterday.',
  'Success is the sum of small efforts repeated daily.',
  'A little progress each day adds up to big results.',
  'Believe you can and you\'re halfway there.',
  'Work hard in silence. Let your results make noise.',
  'Don\'t watch the clock — do what it does. Keep going.',
  'The future belongs to those who prepare for it today.',
  'Push yourself because no one else will do it for you.',
  'Great things take time. Trust the process.',
  'You\'re one study session away from a breakthrough.',
  'Every page you read is a step closer to your goal.',
  'Discipline is the bridge between goals and achievement.',
  'Hard work beats talent when talent doesn\'t work hard.',
  'Your exam result is a reflection of today\'s effort.',
  'Focus on progress, not perfection.',
  'Science fact: The brain retains more in short study bursts!',
  'Taking breaks actually improves memory retention — study smart.',
  'Pakistan has produced Nobel laureates. You could be next.',
];

export function getDailyQuote(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return QUOTES[dayOfYear % QUOTES.length];
}
