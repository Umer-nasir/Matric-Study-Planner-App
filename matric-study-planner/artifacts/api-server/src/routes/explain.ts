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

function explanationText(summary: string, keyPoints: string[]): string {
  return `${summary}\n${keyPoints.join("\n")}`;
}

function isWrongScriptForLanguage(
  language: "english" | "urdu",
  summary: string,
  keyPoints: string[],
): boolean {
  const text = explanationText(summary, keyPoints);
  return language === "english" ? hasUrduScript(text) : hasInvalidUrduScript(text);
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
Respond ONLY with valid JSON in this exact shape: {"summary":"...","keyPoints":["...","..."]}. For Urdu, the JSON string values must be written in proper Urdu script. For English, every JSON string value must use English words and the Latin alphabet only; do not include Urdu, Arabic, Persian, Hindi, or Roman Urdu.`;
    const userPayload = JSON.stringify({
      subject: cleanSubject,
      chapter: cleanChapter,
      board: cleanBoard,
    });
    let completion = await groq.chat.completions.create({
      model: EXPLAIN_MODEL,
      temperature: 0.2,
      max_tokens: 450,
      response_format: { type: "json_object" },
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

    let rawContent = completion.choices[0]?.message?.content ?? "";
    let { summary, keyPoints } = normalizeExplanation(rawContent);

    if (language === "english" && isWrongScriptForLanguage(language, summary, keyPoints)) {
      completion = await groq.chat.completions.create({
        model: EXPLAIN_MODEL,
        temperature: 0,
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You convert chapter explanation JSON into English. Respond only with valid JSON in the exact shape: {\"summary\":\"...\",\"keyPoints\":[\"...\",\"...\"]}. Translate every value into simple English using Latin letters only. Do not include Urdu, Arabic, Persian, Hindi, or Roman Urdu.",
          },
          {
            role: "user",
            content: `Translate this JSON to English only. Keep the same meaning and keep 4-6 concise key points.\n${stripJson(rawContent)}`,
          },
        ],
      });
      rawContent = completion.choices[0]?.message?.content ?? "";
      ({ summary, keyPoints } = normalizeExplanation(rawContent));
    }

    if (language === "urdu" && isWrongScriptForLanguage(language, summary, keyPoints)) {
      completion = await groq.chat.completions.create({
        model: EXPLAIN_MODEL,
        temperature: 0.1,
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nYour previous draft used invalid non-Urdu script. Rewrite all JSON string values using Urdu script only. No Devanagari, Chinese/Japanese characters, or Roman Urdu.`,
          },
          { role: "user", content: userPayload },
        ],
      });
      rawContent = completion.choices[0]?.message?.content ?? "";
      ({ summary, keyPoints } = normalizeExplanation(rawContent));
    }

    if (language === "english" && isWrongScriptForLanguage(language, summary, keyPoints)) {
      res.status(422).json({
        ok: false,
        error: "The AI returned Urdu for an English chapter. Please retry.",
      });
      return;
    }

    if (language === "urdu" && isWrongScriptForLanguage(language, summary, keyPoints)) {
      res.status(422).json({
        ok: false,
        error: "Chapter explanation used an invalid script. Please retry.",
      });
      return;
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
