export type SubjectStudyLanguage = 'english' | 'urdu';

export const LANGUAGE_FIXED_SUBJECTS: Record<string, SubjectStudyLanguage> = {
  English: 'english',
  Urdu: 'urdu',
};

export function canChooseSubjectLanguage(subject: string): boolean {
  return !LANGUAGE_FIXED_SUBJECTS[subject];
}

export function defaultSubjectLanguage(subject: string): SubjectStudyLanguage {
  if (LANGUAGE_FIXED_SUBJECTS[subject]) return LANGUAGE_FIXED_SUBJECTS[subject];
  if (subject === 'Islamiat' || subject === 'Pakistan Studies') return 'urdu';
  return 'english';
}

export function getSubjectStudyLanguage(
  subject: string,
  subjectLanguages?: Record<string, SubjectStudyLanguage>,
): SubjectStudyLanguage {
  return LANGUAGE_FIXED_SUBJECTS[subject] ?? subjectLanguages?.[subject] ?? defaultSubjectLanguage(subject);
}

export function normalizeSubjectLanguages(
  subjects: string[],
  current?: Record<string, SubjectStudyLanguage>,
): Record<string, SubjectStudyLanguage> {
  const result: Record<string, SubjectStudyLanguage> = {};
  for (const subject of subjects) {
    result[subject] = current?.[subject] ?? defaultSubjectLanguage(subject);
  }
  return result;
}
