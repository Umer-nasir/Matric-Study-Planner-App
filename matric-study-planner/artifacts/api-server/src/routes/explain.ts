import { Router, type IRouter, type Request, type Response } from "express";
import Groq from "groq-sdk";
import {
  getLanguageInstruction,
  getSubjectPersona,
  hasInvalidUrduScript,
  hasUrduScript,
  normalizeResponseLanguage,
} from "../config/subjectPersonas";

const router: IRouter = Router();

interface ExplainChapterRequestBody {
  subject?: string;
  chapter?: string;
  board?: string;
  responseLanguage?: string;
}

const EXPLAIN_MODEL = process.env["GROQ_EXPLAIN_MODEL"] ?? "llama-3.1-8b-instant";

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

function normalizeExplanation(rawContent: string): { summary: string; keyPoints: string[] } {
  const raw = stripJson(rawContent);
  const parsed = JSON.parse(raw) as {
    summary?: unknown;
    keyPoints?: unknown;
  };

  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints
        .filter((point): point is string => typeof point === "string" && point.trim().length > 0)
        .slice(0, 6)
        .map((point) => point.trim())
    : [];
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : keyPoints.join(" ");

  return { summary, keyPoints };
}

router.post("/explain-chapter", async (req: Request, res: Response): Promise<void> => {
  const { subject, chapter, board = "Punjab Board", responseLanguage } = req.body as ExplainChapterRequestBody;

  if (!subject || typeof subject !== "string") {
    res.status(400).json({ ok: false, error: "subject is required" });
    return;
  }
  if (!chapter || typeof chapter !== "string") {
    res.status(400).json({ ok: false, error: "chapter is required" });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ ok: false, error: "GROQ_API_KEY is not configured" });
    return;
  }

  const cleanSubject = subject.trim();
  const cleanChapter = chapter.trim();
  const cleanBoard = board.trim() || "Punjab Board";
  const persona = getSubjectPersona(cleanSubject);
  const language = normalizeResponseLanguage(responseLanguage, cleanSubject);
  const groq = new Groq({ apiKey });

  try {
    const systemPrompt = `You are helping a Matric-level (grade 9-10) student in Pakistan quickly understand what a chapter covers, following the ${cleanBoard} syllabus. Give a SHORT summary (not a full lesson) of the chapter '${cleanChapter}' in ${cleanSubject}. Cover only the 4-6 most important key points/concepts a student needs to know. Use simple language and concise exam-focused formatting. Keep the entire response under 150 words.
${getLanguageInstruction(language)}
${persona ? `\n${persona}` : ""}
Respond ONLY with valid JSON in this exact shape: {"summary":"...","keyPoints":["...","..."]}. For Urdu, the JSON string values must be written in proper Urdu script. For English, all JSON string values must be English only.`;
    const userPayload = JSON.stringify({
      subject: cleanSubject,
      chapter: cleanChapter,
      board: cleanBoard,
    });
    let completion = await groq.chat.completions.create({
      model: EXPLAIN_MODEL,
      temperature: 0.2,
      max_tokens: 450,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPayload,
        },
      ],
    });

    let { summary, keyPoints } = normalizeExplanation(completion.choices[0]?.message?.content ?? "");
    if (language === "english" && hasUrduScript(`${summary}\n${keyPoints.join("\n")}`)) {
      completion = await groq.chat.completions.create({
        model: EXPLAIN_MODEL,
        temperature: 0.05,
        max_tokens: 450,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nYour previous draft was in Urdu. Rewrite all JSON string values in English only. Do not use Urdu script.`,
          },
          { role: "user", content: userPayload },
        ],
      });
      ({ summary, keyPoints } = normalizeExplanation(completion.choices[0]?.message?.content ?? ""));
    }

    if (language === "urdu" && hasInvalidUrduScript(`${summary}\n${keyPoints.join("\n")}`)) {
      completion = await groq.chat.completions.create({
        model: EXPLAIN_MODEL,
        temperature: 0.1,
        max_tokens: 450,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nYour previous draft used invalid non-Urdu script. Rewrite all JSON string values using Urdu script only. No Devanagari, Chinese/Japanese characters, or Roman Urdu.`,
          },
          { role: "user", content: userPayload },
        ],
      });
      ({ summary, keyPoints } = normalizeExplanation(completion.choices[0]?.message?.content ?? ""));
    }

    if (!summary && keyPoints.length === 0) {
      throw new Error("Explanation response was empty");
    }

    res.json({ ok: true, summary, keyPoints });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ ok: false, error: `Chapter explanation failed: ${message}` });
  }
});

export default router;
