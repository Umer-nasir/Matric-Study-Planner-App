export interface ScheduleBlock {
  subject: string;
  chapter: string;
  durationMinutes: number;
}

export interface ScheduleDay {
  day: string;
  date: string; // YYYY-MM-DD
  blocks: ScheduleBlock[];
}

export interface AiSchedule {
  week: ScheduleDay[];
  generatedAt: string; // ISO timestamp
}
