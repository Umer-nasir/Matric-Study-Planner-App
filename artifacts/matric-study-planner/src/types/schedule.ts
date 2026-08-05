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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeAiSchedule(value: unknown): AiSchedule | null {
  if (!isRecord(value) || !Array.isArray(value.week) || value.week.length === 0 || value.week.length > 7) {
    return null;
  }
  const week: ScheduleDay[] = [];
  for (const rawDay of value.week) {
    if (!isRecord(rawDay) || typeof rawDay.day !== 'string' || typeof rawDay.date !== 'string' || !Array.isArray(rawDay.blocks)) {
      return null;
    }
    const blocks: ScheduleBlock[] = [];
    for (const rawBlock of rawDay.blocks) {
      if (!isRecord(rawBlock)) return null;
      const durationMinutes = Number(rawBlock.durationMinutes);
      if (
        typeof rawBlock.subject !== 'string' || !rawBlock.subject.trim() ||
        typeof rawBlock.chapter !== 'string' || !rawBlock.chapter.trim() ||
        !Number.isFinite(durationMinutes)
      ) return null;
      blocks.push({
        subject: rawBlock.subject.trim(),
        chapter: rawBlock.chapter.trim(),
        durationMinutes: Math.max(10, Math.min(180, Math.round(durationMinutes))),
      });
    }
    week.push({ day: rawDay.day, date: rawDay.date, blocks });
  }
  return {
    week,
    generatedAt: typeof value.generatedAt === 'string' && Number.isFinite(Date.parse(value.generatedAt))
      ? value.generatedAt
      : new Date().toISOString(),
  };
}
