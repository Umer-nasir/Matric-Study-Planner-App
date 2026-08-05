export type PracticeQuestionType = "mcq" | "short" | "long" | "definition";

export interface ValidatedPracticeData {
  mcqs?: Array<{ subject?: string; chapter?: string; question: string; options: string[]; correctIndex: number; explanation: string }>;
  shortQuestions?: Array<{ subject?: string; chapter?: string; question: string; modelAnswer: string }>;
  longQuestions?: Array<{ subject?: string; chapter?: string; question: string; modelAnswer: string }>;
  definitions?: Array<{ subject?: string; chapter?: string; term: string; definition: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Practice response has an invalid ${field}`);
  return value.trim();
}

function requiredArray(value: unknown, field: string, expectedCount: number): unknown[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`Practice response must contain exactly ${expectedCount} ${field}`);
  }
  return value;
}

function targetMetadata(
  item: Record<string, unknown>,
  allowedTargets?: ReadonlyArray<{ subject: string; chapter: string }>,
): { subject?: string; chapter?: string } {
  if (!allowedTargets) return {};
  const subject = requiredText(item.subject, 'question subject');
  const chapter = requiredText(item.chapter, 'question chapter');
  if (!allowedTargets.some((target) => target.subject === subject && target.chapter === chapter)) {
    throw new Error(`Practice response used an unselected target: ${subject} / ${chapter}`);
  }
  return { subject, chapter };
}

export function validatePracticeData(
  value: unknown,
  questionTypes: readonly PracticeQuestionType[],
  expectedCount: number,
  allowedTargets?: ReadonlyArray<{ subject: string; chapter: string }>,
): ValidatedPracticeData {
  if (!isRecord(value)) throw new Error("Practice response was not a JSON object");
  const result: ValidatedPracticeData = {};

  if (questionTypes.includes("mcq")) {
    result.mcqs = requiredArray(value.mcqs, "MCQs", expectedCount).map((item, index) => {
      if (!isRecord(item)) throw new Error(`Practice response has an invalid MCQ at position ${index + 1}`);
      if (!Array.isArray(item.options) || item.options.length !== 4) {
        throw new Error(`MCQ ${index + 1} must have exactly four options`);
      }
      const options = item.options.map((option, optionIndex) => requiredText(option, `MCQ ${index + 1} option ${optionIndex + 1}`));
      const correctIndex = Number(item.correctIndex);
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        throw new Error(`MCQ ${index + 1} has an invalid correctIndex`);
      }
      return {
        ...targetMetadata(item, allowedTargets),
        question: requiredText(item.question, `MCQ ${index + 1} question`),
        options,
        correctIndex,
        explanation: requiredText(item.explanation, `MCQ ${index + 1} explanation`),
      };
    });
  }

  if (questionTypes.includes("short")) {
    result.shortQuestions = requiredArray(value.shortQuestions, "short questions", expectedCount).map((item, index) => {
      if (!isRecord(item)) throw new Error(`Practice response has an invalid short question at position ${index + 1}`);
      return {
        ...targetMetadata(item, allowedTargets),
        question: requiredText(item.question, `short question ${index + 1}`),
        modelAnswer: requiredText(item.modelAnswer, `short question ${index + 1} model answer`),
      };
    });
  }

  if (questionTypes.includes("long")) {
    result.longQuestions = requiredArray(value.longQuestions, "long questions", expectedCount).map((item, index) => {
      if (!isRecord(item)) throw new Error(`Practice response has an invalid long question at position ${index + 1}`);
      return {
        ...targetMetadata(item, allowedTargets),
        question: requiredText(item.question, `long question ${index + 1}`),
        modelAnswer: requiredText(item.modelAnswer, `long question ${index + 1} model answer`),
      };
    });
  }

  if (questionTypes.includes("definition")) {
    result.definitions = requiredArray(value.definitions, "definitions", expectedCount).map((item, index) => {
      if (!isRecord(item)) throw new Error(`Practice response has an invalid definition at position ${index + 1}`);
      return {
        ...targetMetadata(item, allowedTargets),
        term: requiredText(item.term, `definition ${index + 1} term`),
        definition: requiredText(item.definition, `definition ${index + 1}`),
      };
    });
  }

  return result;
}
