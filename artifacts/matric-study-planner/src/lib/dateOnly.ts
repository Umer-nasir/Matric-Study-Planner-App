const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function fromLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function toDateInputValue(value: string): string {
  const dateOnly = DATE_ONLY_RE.exec(value)?.[0];
  if (dateOnly) return dateOnly;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return fromLocalDate(parsed);
}

export function dateInputValueToExamDate(value: string): string {
  return toDateInputValue(value);
}

export function dateOnlyToLocalDate(value: string, hours = 0): Date {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) return new Date(value);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), hours, 0, 0, 0);
}

export function examDateToLocalDate(value: string, hours = 0): Date {
  return dateOnlyToLocalDate(toDateInputValue(value), hours);
}

export function todayDateOnly(now = new Date()): string {
  return fromLocalDate(now);
}

export function addDaysDateOnly(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return fromLocalDate(date);
}

export function daysUntilDateOnly(value: string, now = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = examDateToLocalDate(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
