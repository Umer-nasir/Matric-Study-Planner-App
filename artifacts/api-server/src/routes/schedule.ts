import { Router, type IRouter, type Request, type Response } from "express";
import Groq from "groq-sdk";
import { normalizeScheduleDates } from "../lib/scheduleDates";

const router: IRouter = Router();

// ── Types ────────────────────────────────────────────────────────────────────

interface SubjectInput {
  name: string;
  totalChapters: number;
  completedChapters: number;
  chapterList: { name: string; done: boolean; selectedForSchedule?: boolean }[];
}

interface ScheduleRequestBody {
  subjects: SubjectInput[];
  daysLeft: number;
  currentMode: "fun" | "balanced" | "focus";
  studyHoursPerDay?: number;
  startDate?: string;
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(mode: "fun" | "balanced" | "focus"): string {
  const modeInstructions =
    mode === "focus"
      ? `This student is running LOW on time. Be aggressive about pacing — assign more study blocks per day (up to 5), prioritize ruthlessly by urgency (most incomplete subjects first), and keep durations focused (30-50 min each). Minimal buffer time. Every block must count.`
      : mode === "balanced"
      ? `Balance the student's workload across subjects. Aim for 3-4 blocks per day, 40-50 minutes each. Mix subjects so no single one dominates two days in a row. Leave some breathing room.`
      : `Keep the daily load manageable and motivating (2-3 blocks per day, 35-45 min each). Vary subjects to keep things interesting. The student has plenty of time, so build a steady, sustainable rhythm rather than cramming.`;

  return `You are a study planning assistant for a Matric-level student in Pakistan.

${modeInstructions}

Given the student's subjects, remaining chapters, and days left until exams, generate a realistic 7-day study schedule.
Rules:
- Only assign INCOMPLETE chapters (done: false) as study blocks.
- Prioritize subjects with more incomplete chapters relative to their total.
- Each block covers exactly one chapter.
- Use realistic day names starting from today (Monday, Tuesday, etc.).
- Respond ONLY with valid JSON — no markdown fences, no explanation, no extra text.

Exact response format:
{
  "week": [
    {
      "day": "Monday",
      "date": "YYYY-MM-DD",
      "blocks": [
        { "subject": "Physics", "chapter": "Vectors", "durationMinutes": 45 }
      ]
    }
  ]
}`;
}

// ── Endpoint ──────────────────────────────────────────────────────────────────

router.post(
  "/generate-schedule",
  async (req: Request, res: Response): Promise<void> => {
    const { subjects, daysLeft, currentMode, studyHoursPerDay = 3, startDate } =
      req.body as ScheduleRequestBody;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      res.status(400).json({ error: "subjects array is required" });
      return;
    }

    if (!subjects.every((item) =>
      item &&
      typeof item.name === "string" &&
      Array.isArray(item.chapterList) &&
      item.chapterList.every((chapterItem) => chapterItem && typeof chapterItem.name === "string")
    )) {
      res.status(400).json({ error: "subjects contains invalid chapter data" });
      return;
    }

    if (currentMode !== "fun" && currentMode !== "balanced" && currentMode !== "focus") {
      res.status(400).json({ error: "currentMode is invalid" });
      return;
    }

    if (!startDate || typeof startDate !== "string") {
      res.status(400).json({ error: "local startDate is required" });
      return;
    }

    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      res.status(500).json({ error: "GROQ_API_KEY is not configured" });
      return;
    }

    const groq = new Groq({ apiKey });

    // Build user message with real data
    const userMessage = JSON.stringify({
      daysLeft,
      studyHoursPerDay,
      subjects: subjects.map((s) => ({
        name: s.name,
        totalChapters: s.totalChapters,
        completedChapters: s.completedChapters,
        incompleteChapters: s.chapterList
          .filter((c) => !c.done && c.selectedForSchedule !== false)
          .map((c) => c.name),
      })),
    });

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 4096,
        messages: [
          { role: "system", content: buildSystemPrompt(currentMode) },
          {
            role: "user",
            content: `Generate a 7-day study schedule for this student:\n${userMessage}`,
          },
        ],
      });

      let raw = completion.choices[0]?.message?.content ?? "";

      // Strip markdown fences defensively
      raw = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      // Extract JSON object if there's any preamble
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      if (jsonStart !== -1 && jsonEnd !== -1) {
        raw = raw.slice(jsonStart, jsonEnd + 1);
      }

      const allowedTargets = Object.fromEntries(
        subjects.map((item) => [
          item.name,
          item.chapterList
            .filter((chapterItem) => !chapterItem.done && chapterItem.selectedForSchedule !== false)
            .map((chapterItem) => chapterItem.name),
        ]),
      );
      const schedule = normalizeScheduleDates(JSON.parse(raw), startDate, allowedTargets);

      // Validate shape
      if (!schedule.week || !Array.isArray(schedule.week)) {
        throw new Error("Invalid schedule shape — missing week array");
      }

      res.json({ ok: true, schedule });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ ok: false, error: `AI generation failed: ${message}` });
    }
  }
);

export default router;
