import { Router, type IRouter, type Request, type Response } from "express";
import Groq from "groq-sdk";
import { ENGLISH_ONLY_INSTRUCTION, hasUrduScript } from "../config/genericAi";

const router: IRouter = Router();

type QuestionType = "mcq" | "short" | "long" | "definition";
type PracticeMode = "chapter" | "quiz" | "revision";
type ExamStyleTag = "past-paper" | "board-mcq" | "short-question" | "long-question" | "tashreeh" | "application";

interface PracticeTarget {
  subject?: string;
  chapter?: string;
  reason?: string;
}

interface PracticeRequestBody {
  subject?: string;
  chapter?: string;
  board?: string;
  questionTypes?: QuestionType[];
  countPerType?: number;
  totalQuestions?: number;
  mode?: PracticeMode;
  chapters?: PracticeTarget[];
  examStyle?: ExamStyleTag;
}

interface CheckDefinitionRequestBody {
  subject?: string;
  chapter?: string;
  board?: string;
  term?: string;
  expectedDefinition?: string;
  studentAnswer?: string;
}

const FAST_PRACTICE_MODEL = process.env["GROQ_PRACTICE_FAST_MODEL"] ?? "llama-3.1-8b-instant";

function isQuestionType(value: unknown): value is QuestionType {
  return value === "mcq" || value === "short" || value === "long" || value === "definition";
}

function normalizeExamStyle(value: unknown): ExamStyleTag {
  return value === "past-paper" ||
    value === "board-mcq" ||
    value === "short-question" ||
    value === "long-question" ||
    value === "tashreeh" ||
    value === "application"
    ? value
    : "board-mcq";
}

function examStyleInstruction(style: ExamStyleTag): string {
  switch (style) {
    case "past-paper":
      return "Use past-paper style: board-paper wording, familiar command words, and direct exam phrasing.";
    case "board-mcq":
      return "Use Board-Style MCQ format: concise stem, four plausible options, one clear correct answer, and board-typical wording.";
    case "tashreeh":
      return "Use Explanation Practice style: ask for interpretation or explanation in clear English.";
    case "application":
      return "Use Application style: prefer applied, numerical, diagram-based, or real-scenario problem solving instead of simple recall.";
    case "short-question":
      return "Use Short Question style: answerable in 2-4 exam-relevant lines with precise keywords.";
    case "long-question":
      return "Use Long Question style: prompts should require organized headings, steps, or explanation suitable for a board long answer.";
    default:
      return "Use board-style exam phrasing.";
  }
}

function stripJson(raw: string): string {
  let cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

function parseAiJson(rawContent: string): unknown {
  const raw = stripJson(rawContent);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    const repaired = raw.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    return JSON.parse(repaired) as unknown;
  }
}

function buildSystemPrompt({
  subject,
  chapter,
  board,
  mode,
  targets,
  totalQuestions,
  examStyle,
}: {
  subject: string;
  chapter: string;
  board: string;
  mode: PracticeMode;
  targets: Array<{ subject: string; chapter: string; reason?: string }>;
  totalQuestions?: number;
  examStyle: ExamStyleTag;
}): string {
  const targetText =
    targets.length > 1
      ? targets
          .map((target) => `- ${target.subject}: ${target.chapter}`)
          .join("\n")
      : `- ${subject}: ${chapter}`;
  const distribution =
    targets.length > 1
      ? "Spread the questions as evenly as possible across the listed chapters. Do not use chapters outside this list."
      : "Use only this chapter.";
  const quizInstruction =
    mode === "quiz" && totalQuestions
      ? `This is quiz mode. Generate exactly ${totalQuestions} MCQs total, with no short, long, or definition questions unless explicitly requested.`
      : "";
  const revisionInstruction =
    mode === "revision"
      ? "This is revision mode. Mix question styles for active recall and keep questions exam-relevant."
      : "";

  return `You are creating exam practice questions for a Matric-level (grade 9-10) student in Pakistan, following the ${board} syllabus. Generate questions strictly from these target chapters:
${targetText}
${distribution}
${quizInstruction}
${revisionInstruction}
${examStyleInstruction(examStyle)}
${ENGLISH_ONLY_INSTRUCTION}
Match the difficulty and phrasing style of real board exam papers. Respond ONLY with valid JSON, no markdown, no explanation, in this exact structure:
{
  "mcqs": [{ "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..." }],
  "shortQuestions": [{ "question": "...", "modelAnswer": "..." }],
  "longQuestions": [{ "question": "...", "modelAnswer": "..." }],
  "definitions": [{ "term": "...", "definition": "..." }]
}
Only include the arrays for question types that were requested; omit others entirely.`;
}

function containsBlockedScript(value: unknown): boolean {
  return hasUrduScript(JSON.stringify(value));
}

router.post("/generate-practice", async (req: Request, res: Response): Promise<void> => {
  const {
    subject,
    chapter,
    board = "Punjab Board",
    questionTypes,
    countPerType = 3,
    totalQuestions,
    mode = "chapter",
    chapters,
    examStyle,
  } = req.body as PracticeRequestBody;

  const targets =
    Array.isArray(chapters) && chapters.length > 0
      ? chapters
          .filter(
            (item) =>
              item &&
              typeof item.subject === "string" &&
              item.subject.trim() &&
              typeof item.chapter === "string" &&
              item.chapter.trim(),
          )
          .map((item) => ({
            subject: item.subject!.trim(),
            chapter: item.chapter!.trim(),
            reason: typeof item.reason === "string" ? item.reason.trim() : undefined,
          }))
      : subject && chapter
      ? [{ subject: subject.trim(), chapter: chapter.trim() }]
      : [];

  if (!subject || typeof subject !== "string") {
    res.status(400).json({ ok: false, error: "subject is required" });
    return;
  }
  if (!chapter || typeof chapter !== "string") {
    res.status(400).json({ ok: false, error: "chapter is required" });
    return;
  }
  if (targets.length === 0) {
    res.status(400).json({ ok: false, error: "Select at least one chapter." });
    return;
  }
  if (!Array.isArray(questionTypes) || questionTypes.length === 0 || !questionTypes.every(isQuestionType)) {
    res.status(400).json({ ok: false, error: "Select at least one valid question type." });
    return;
  }

  const safeCount = Math.max(1, Math.min(8, Number(countPerType) || 3));
  const safeTotalQuestions =
    typeof totalQuestions === "number" ? Math.max(1, Math.min(15, totalQuestions)) : undefined;
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ ok: false, error: "GROQ_API_KEY is not configured" });
    return;
  }

  const groq = new Groq({ apiKey });
  const model = FAST_PRACTICE_MODEL;
  const safeExamStyle = normalizeExamStyle(examStyle);

  try {
    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.25,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({
            subject: subject.trim(),
            chapter: chapter.trim(),
            board: board.trim() || "Punjab Board",
            mode,
            targets,
            totalQuestions: safeTotalQuestions,
            examStyle: safeExamStyle,
          }),
        },
        {
          role: "user",
          content: JSON.stringify({
            subject: subject.trim(),
            chapter: chapter.trim(),
            board: board.trim() || "Punjab Board",
            mode,
            targets,
            questionTypes,
            countPerType: safeCount,
            totalQuestions: safeTotalQuestions,
            examStyle: safeExamStyle,
          }),
        },
      ],
    });

    const data = parseAiJson(completion.choices[0]?.message?.content ?? "");

    if (!data || typeof data !== "object") {
      throw new Error("Practice response was not a JSON object");
    }

    if (containsBlockedScript(data)) {
      res.status(422).json({ ok: false, error: "The AI returned non-English practice content. Please retry." });
      return;
    }

    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ ok: false, error: `Practice generation failed: ${message}` });
  }
});

router.post("/check-definition", async (req: Request, res: Response): Promise<void> => {
  const {
    subject,
    chapter,
    board = "Punjab Board",
    term,
    expectedDefinition,
    studentAnswer,
  } = req.body as CheckDefinitionRequestBody;

  if (!subject || typeof subject !== "string") {
    res.status(400).json({ ok: false, error: "subject is required" });
    return;
  }
  if (!chapter || typeof chapter !== "string") {
    res.status(400).json({ ok: false, error: "chapter is required" });
    return;
  }
  if (!term || typeof term !== "string") {
    res.status(400).json({ ok: false, error: "term is required" });
    return;
  }
  if (!expectedDefinition || typeof expectedDefinition !== "string") {
    res.status(400).json({ ok: false, error: "expectedDefinition is required" });
    return;
  }
  if (!studentAnswer || typeof studentAnswer !== "string" || studentAnswer.trim().length < 5) {
    res.status(400).json({ ok: false, error: "Write a definition before checking." });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ ok: false, error: "GROQ_API_KEY is not configured" });
    return;
  }

  const groq = new Groq({ apiKey });

  try {
    const completion = await groq.chat.completions.create({
      model: FAST_PRACTICE_MODEL,
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are checking a Matric-level student's definition answer for ${board}. Be fair but exam-focused. If the student's answer contains the core meaning, mark it correct even if wording is different.
${ENGLISH_ONLY_INSTRUCTION}
Respond ONLY with valid JSON in this exact shape: {"correct":true,"feedback":"...","modelAnswer":"..."}. Feedback must be short and helpful.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            subject,
            chapter,
            term,
            expectedDefinition,
            studentAnswer,
          }),
        },
      ],
    });

    const data = parseAiJson(completion.choices[0]?.message?.content ?? "") as {
      correct?: unknown;
      feedback?: unknown;
      modelAnswer?: unknown;
    };

    if (containsBlockedScript(data)) {
      res.status(422).json({ ok: false, error: "The AI returned non-English definition feedback. Please retry." });
      return;
    }

    res.json({
      ok: true,
      data: {
        correct: Boolean(data.correct),
        feedback:
          typeof data.feedback === "string"
            ? data.feedback
            : "Compare your answer with the model answer.",
        modelAnswer:
          typeof data.modelAnswer === "string" ? data.modelAnswer : expectedDefinition,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ ok: false, error: `Definition check failed: ${message}` });
  }
});

export default router;
