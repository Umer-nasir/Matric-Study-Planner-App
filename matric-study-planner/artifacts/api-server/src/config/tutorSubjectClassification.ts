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
  if (typeof value === 'string') {
    try {
      return sanitizeAvailableTutorSubjects(JSON.parse(value));
    } catch {
      return [];
    }
  }

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

export function parseTaggedTutorReply(
  reply: string,
  availableSubjects: string[],
  fallbackSubject: string,
): { reply: string; subject: string } {
  const match = reply.match(/^\s*\[\[SUBJECT:\s*([^\]\r\n]+)\]\]\s*/i);
  if (!match) return { reply, subject: fallbackSubject };

  const cleanedReply = reply.slice(match[0].length).trim();
  const subject =
    fallbackSubject !== 'General'
      ? fallbackSubject
      : parseTutorSubjectClassification(match[1] ?? '', availableSubjects);

  return {
    reply: cleanedReply || reply,
    subject,
  };
}
