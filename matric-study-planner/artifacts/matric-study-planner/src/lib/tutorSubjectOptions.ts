import { SUBJECTS } from '../data/syllabus.ts';

const TUTOR_SUBJECT_SET = new Set<string>(SUBJECTS);

export function buildTutorSubjectOptions(profileSubjects: readonly string[] = []): string[] {
  const selectedSubjects = [
    ...new Set(profileSubjects.filter((subject) => TUTOR_SUBJECT_SET.has(subject))),
  ];
  const remainingSubjects = SUBJECTS.filter((subject) => !selectedSubjects.includes(subject));

  return ['General', ...selectedSubjects, ...remainingSubjects];
}
