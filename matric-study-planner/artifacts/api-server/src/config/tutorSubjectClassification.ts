export const TUTOR_SUBJECTS = [
  'Physics',
  'Chemistry',
  'Mathematics',
  'Biology',
  'Computer Science',
  'English',
  'Urdu',
  'Islamiat',
  'Pakistan Studies',
] as const;

const TUTOR_SUBJECT_SET = new Set<string>(TUTOR_SUBJECTS);

export function sanitizeAvailableTutorSubjects(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value.filter(
        (subject): subject is string =>
          typeof subject === 'string' && TUTOR_SUBJECT_SET.has(subject),
      ),
    ),
  ];
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function readCandidateLabel(reply: string): string {
  const trimmed = reply.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object') {
      const subject = (parsed as Record<string, unknown>)['subject'];
      if (typeof subject === 'string') return subject;
    }
  } catch {
    // Plain labels are the expected response format.
  }

  const firstLine = trimmed
    .replace(/^```(?:text|json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .split(/\r?\n/, 1)[0] ?? '';

  return firstLine
    .replace(/^subject\s*:\s*/i, '')
    .replace(/^[\s`"'*]+|[\s`"'*.]+$/g, '');
}

export function parseTutorSubjectClassification(
  reply: string,
  availableSubjects: string[],
): string {
  const candidate = normalizeLabel(readCandidateLabel(reply));
  if (candidate === 'general') return 'General';

  const match = availableSubjects.find(
    (subject) => normalizeLabel(subject) === candidate,
  );
  return match ?? 'General';
}
