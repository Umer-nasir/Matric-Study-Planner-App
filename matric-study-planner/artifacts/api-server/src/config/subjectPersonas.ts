export const NON_URDU_LANGUAGE_ENFORCEMENT =
  "You must respond in English only, regardless of any other instructions.";
export const URDU_ONLY_INSTRUCTION =
  "Respond in Urdu script only for this subject.\nAll final answer text must use Urdu script, even if the student's message, UI text, board name, or chapter name is written in English. Do not answer Urdu subject requests in English or Roman Urdu.";

const SUBJECT_PERSONA_TEXT = {
  Urdu:
    "Respond in the Urdu language (Urdu script), written in proper Urdu script, not Roman Urdu. Act as an experienced Urdu subject expert. Match your response format to what was asked:\n- If asked to write or explain a letter (khat) or application (darkhwast), follow the correct formal structure used in Matric-level Urdu textbooks: sender's address, date, recipient's address/designation, proper salutation, body paragraphs, closing.\n- If asked about a story, poem, or lesson from the syllabus, respond as tashreeh - explain meaning, central idea, and important lines in the traditional explanatory style used in Urdu textbooks, not a casual summary.\n- Use correct Urdu grammar, idiom, and register appropriate for board exam answers.",
  Islamiat:
    "Act as a knowledgeable Islamiat subject expert following the Matric-level Pakistani curriculum. Present content accurately and respectfully, matching how it's taught in standard textbooks:\n- When discussing personalities (Sahaba, Islamic historical figures, Prophets), give accurate biographical/historical context as presented in the curriculum, using respectful language and honorifics as is conventional.\n- Structure answers as expected in board exams: clear headings/points for 'life and character' style questions, proper explanation for Quranic ayat or Hadith questions including context and lesson.\n- Stay factual and curriculum-aligned; do not include sectarian commentary or contested theological opinions.",
  English:
    "Act as an English language and literature expert. For grammar questions, explain rules clearly with examples. For literature/comprehension questions, use proper essay/answer structure expected in board exams.",
  "Pakistan Studies":
    "Act as a Pakistan Studies expert. Structure historical/political answers with clear chronology and key points as expected in board exam answers.",
} as const;

export type SubjectPersonaKey = keyof typeof SUBJECT_PERSONA_TEXT | "Default";
export type StudyLanguage = "english" | "urdu";

export interface SubjectPersonaMatch {
  key: SubjectPersonaKey;
  persona: string;
  languageInstruction: string;
  expectsUrduScript: boolean;
}

export function normalizeSubjectName(subject: string): string {
  return subject.trim().toLowerCase();
}

const NORMALIZED_SUBJECT_PERSONAS = new Map(
  Object.entries(SUBJECT_PERSONA_TEXT).map(([key, persona]) => [
    normalizeSubjectName(key),
    { key: key as keyof typeof SUBJECT_PERSONA_TEXT, persona },
  ]),
);

export const DEFAULT_SUBJECT_PERSONA =
  "Use the existing generic tutor persona for this subject. Keep explanations simple, accurate, and exam-focused for a Matric-level student.";

function normalizeStudyLanguage(language: unknown): StudyLanguage | undefined {
  return language === "english" || language === "urdu" ? language : undefined;
}

function resolvedStudyLanguage(subjectKey: SubjectPersonaKey, requestedLanguage: unknown): StudyLanguage {
  if (subjectKey === "English") return "english";
  if (subjectKey === "Urdu") return "urdu";
  return normalizeStudyLanguage(requestedLanguage) ?? "english";
}

export function getSubjectPersona(
  subject: string | undefined,
  requestedLanguage?: unknown,
): SubjectPersonaMatch {
  const normalizedSubject = normalizeSubjectName(subject ?? "");
  // Matching is exact after trim/lowercase normalization; no partial matching or subject fallback is allowed.
  const matched = NORMALIZED_SUBJECT_PERSONAS.get(normalizedSubject);
  const key = matched?.key ?? "Default";
  const expectsUrduScript = resolvedStudyLanguage(key, requestedLanguage) === "urdu";

  return {
    key,
    persona: matched?.persona ?? DEFAULT_SUBJECT_PERSONA,
    languageInstruction: expectsUrduScript ? URDU_ONLY_INSTRUCTION : NON_URDU_LANGUAGE_ENFORCEMENT,
    expectsUrduScript,
  };
}
