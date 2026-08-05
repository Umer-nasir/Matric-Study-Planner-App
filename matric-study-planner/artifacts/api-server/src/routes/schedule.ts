import { Router, type IRouter, type Request, type Response } from "express";
import Groq from "groq-sdk";

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
}

interface GeneratedSchedule {
  week?: unknown[];
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

function normalizeScheduleDates(schedule: unknown): GeneratedSchedule {
  if (!schedule || typeof schedule !== "object") return {};

  const candidate = schedule as { week?: unknown };
  if (!Array.isArray(candidate.week)) return schedule as GeneratedSchedule;

  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  candidate.week = candidate.week.slice(0, 7).map((day, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    return {
      ...(day && typeof day === "object" ? day : {}),
      day: formatter.format(date),
      date: date.toISOString().slice(0, 10),
    };
  });

  return candidate as GeneratedSchedule;
}

// ── Endpoint ──────────────────────────────────────────────────────────────────

router.post(
  "/generate-schedule",
  async (req: Request, res: Response): Promise<void> => {
    const { subjects, daysLeft, currentMode, studyHoursPerDay = 3 } =
      req.body as ScheduleRequestBody;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      res.status(400).json({ error: "subjects array is required" });
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

      const schedule = normalizeScheduleDates(JSON.parse(raw));

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
