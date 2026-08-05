import { BOARDS, SUBJECTS } from '../data/syllabus.ts';
import { daysUntilDateOnly, toDateInputValue } from './dateOnly.ts';

export const ONBOARDING_PROFILE_VERSION = 1;
export const MAX_EXAM_DATE_DAYS = 1095;

const KNOWN_PLACEHOLDER_EXAM_DATES = new Set(['2099-12-31', '2100-01-01', '9999-12-31']);
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface Profile {
  board: string;
  subjects: string[];
  examDate: string;
  onboardingComplete: boolean;
  onboardingCompletedAt: string;
  onboardingVersion: number;
}

type CompletedProfileInput = Pick<Profile, 'board' | 'subjects' | 'examDate'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function hasValidCompletionReceipt(profile: Record<string, unknown>): boolean {
  if (profile.onboardingVersion !== ONBOARDING_PROFILE_VERSION) return false;
  if (typeof profile.onboardingCompletedAt !== 'string') return false;
  return Number.isFinite(Date.parse(profile.onboardingCompletedAt));
}

export function isValidBoard(value: unknown): value is string {
  return typeof value === 'string' && BOARDS.includes(value);
}

export function validSubjects(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (subject): subject is string => typeof subject === 'string' && SUBJECTS.includes(subject),
      ),
    ),
  ];
}

export function isValidExamDate(value: unknown, now = new Date()): value is string {
  if (!isStoredExamDate(value)) return false;

  const dateOnly = toDateInputValue(value);
  const daysUntilExam = daysUntilDateOnly(dateOnly, now);
  return Number.isFinite(daysUntilExam) && daysUntilExam > 0 && daysUntilExam <= MAX_EXAM_DATE_DAYS;
}

/**
 * Validates a date already saved in a completed profile. Unlike a new exam
 * date, an existing one remains valid on and after exam day so the student's
 * profile and progress are not discarded when the calendar advances.
 */
export function isStoredExamDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  const dateOnly = toDateInputValue(value);
  if (!dateOnly || KNOWN_PLACEHOLDER_EXAM_DATES.has(dateOnly)) return false;

  const match = DATE_ONLY_RE.exec(dateOnly);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return false;
  }

  return true;
}

export function hasCompletedOnboarding(value: unknown, _now = new Date()): value is Profile {
  if (!isRecord(value) || value.onboardingComplete !== true) return false;
  if (!hasValidCompletionReceipt(value)) return false;
  if (!isValidBoard(value.board)) return false;
  if (validSubjects(value.subjects).length === 0) return false;
  return isStoredExamDate(value.examDate);
}

export function normalizeCompletedProfile(value: unknown, now = new Date()): Profile | null {
  if (!hasCompletedOnboarding(value, now)) return null;

  return {
    board: value.board,
    subjects: validSubjects(value.subjects),
    examDate: toDateInputValue(value.examDate),
    onboardingComplete: true,
    onboardingCompletedAt: value.onboardingCompletedAt,
    onboardingVersion: ONBOARDING_PROFILE_VERSION,
  };
}

export function createCompletedProfile(
  input: CompletedProfileInput,
  completedAt = new Date(),
): Profile {
  return {
    board: input.board,
    subjects: validSubjects(input.subjects),
    examDate: toDateInputValue(input.examDate),
    onboardingComplete: true,
    onboardingCompletedAt: completedAt.toISOString(),
    onboardingVersion: ONBOARDING_PROFILE_VERSION,
  };
}

export function postAuthRoute(profile: unknown, now = new Date()): '/onboarding' | '/dashboard' {
  return hasCompletedOnboarding(profile, now) ? '/dashboard' : '/onboarding';
}
