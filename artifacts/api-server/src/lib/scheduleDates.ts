export interface GeneratedScheduleBlock {
  subject: string;
  chapter: string;
  durationMinutes: number;
}

export interface GeneratedScheduleDay {
  day: string;
  date: string;
  blocks: GeneratedScheduleBlock[];
}

export interface GeneratedSchedule {
  week: GeneratedScheduleDay[];
}

export type AllowedScheduleTargets = Record<string, readonly string[]>;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) return null;
  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeScheduleDates(
  schedule: unknown,
  startDate: string,
  allowedTargets?: AllowedScheduleTargets,
): GeneratedSchedule {
  const firstDate = parseDateOnly(startDate);
  if (!firstDate) throw new Error("Invalid local start date");
  if (!isRecord(schedule) || !Array.isArray(schedule.week) || schedule.week.length !== 7) {
    throw new Error("Invalid schedule shape: expected exactly seven days");
  }

  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
  const week = schedule.week.map((rawDay, index): GeneratedScheduleDay => {
    if (!isRecord(rawDay) || !Array.isArray(rawDay.blocks)) {
      throw new Error(`Invalid schedule day at position ${index + 1}`);
    }

    const blocks = rawDay.blocks.map((rawBlock, blockIndex): GeneratedScheduleBlock => {
      if (!isRecord(rawBlock)) {
        throw new Error(`Invalid study block on day ${index + 1}, position ${blockIndex + 1}`);
      }
      const subject = typeof rawBlock.subject === "string" ? rawBlock.subject.trim() : "";
      const chapter = typeof rawBlock.chapter === "string" ? rawBlock.chapter.trim() : "";
      const durationMinutes = Number(rawBlock.durationMinutes);
      if (!subject || !chapter || !Number.isFinite(durationMinutes) || durationMinutes < 10 || durationMinutes > 180) {
        throw new Error(`Invalid study block on day ${index + 1}, position ${blockIndex + 1}`);
      }
      if (allowedTargets && !allowedTargets[subject]?.includes(chapter)) {
        throw new Error(`AI scheduled an unselected chapter: ${subject} / ${chapter}`);
      }
      return { subject, chapter, durationMinutes: Math.round(durationMinutes) };
    });

    const date = new Date(firstDate);
    date.setUTCDate(firstDate.getUTCDate() + index);
    return {
      day: formatter.format(date),
      date: date.toISOString().slice(0, 10),
      blocks,
    };
  });

  return { week };
}
