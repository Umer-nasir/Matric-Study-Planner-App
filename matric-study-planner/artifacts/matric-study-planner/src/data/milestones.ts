export interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const MILESTONES: Milestone[] = [
  {
    id: 'first_chapter',
    title: 'First Chapter Done',
    description: 'You completed your very first chapter. The journey begins!',
    icon: '📖',
  },
  {
    id: 'three_day_streak',
    title: '3-Day Streak',
    description: 'Three days in a row — consistency is your superpower.',
    icon: '🔥',
  },
  {
    id: 'seven_day_streak',
    title: '7-Day Streak',
    description: 'A full week of studying. Unstoppable!',
    icon: '⚡',
  },
  {
    id: 'subject_master',
    title: 'Subject Master',
    description: 'You hit 100% in a subject. Pure mastery.',
    icon: '🏆',
  },
  {
    id: 'halfway_hero',
    title: 'Halfway Hero',
    description: 'You are halfway through the entire syllabus!',
    icon: '⭐',
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Studying before 9am? You are built differently.',
    icon: '🌅',
  },
  {
    id: 'comeback_kid',
    title: 'Comeback Kid',
    description: 'You were away, but you came back stronger.',
    icon: '💪',
  },
  {
    id: 'planner_pro',
    title: 'Planner Pro',
    description: 'Added your first custom event. Life + study, balanced.',
    icon: '📅',
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Studied between 11pm and 4am. Quiet hours, serious focus.',
    icon: '🌙',
  },
  {
    id: 'test_hero',
    title: 'Test Hero',
    description: 'Scored 90% or higher on a practice MCQ set.',
    icon: '🛡️',
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Scored 100% on a practice set with 5 or more questions.',
    icon: '💎',
  },
  {
    id: 'practice_makes_perfect',
    title: 'Practice Makes Perfect',
    description: 'Completed 10 total practice sessions.',
    icon: '📝',
  },
  {
    id: 'comeback_scholar',
    title: 'Comeback Scholar',
    description: 'Returned to a weak chapter and scored 80% or higher.',
    icon: '🎓',
  },
];

export function getMilestoneById(id: string): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}
