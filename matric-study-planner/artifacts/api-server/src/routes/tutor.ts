import { createRequire } from "node:module";
import { Router, type IRouter, type Request, type Response } from "express";
import Groq from "groq-sdk";
import mammoth from "mammoth";
import multer from "multer";
import type pdfParseType from "pdf-parse";
import { getSubjectPersona, hasInvalidUrduScript, isUrduSubject } from "../config/subjectPersonas";

const router: IRouter = Router();
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as typeof pdfParseType;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 4000;
const FAST_TEXT_MODEL = process.env["GROQ_TUTOR_FAST_MODEL"] ?? "llama-3.1-8b-instant";
const DEEP_TEXT_MODEL = process.env["GROQ_TUTOR_DEEP_MODEL"] ?? "llama-3.3-70b-versatile";
const VISION_MODEL = "qwen/qwen3.6-27b";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

type StudyMode = "fun" | "balanced" | "focus";
type ChatRole = "user" | "assistant";
type UploadedFileKind = "image" | "pdf" | "docx" | "doc" | "unsupported";

interface ConversationMessage {
  role: ChatRole;
  content: string;
}

interface TutorChatRequestBody {
  message?: string;
  subject?: string;
  board?: string;
  currentMode: StudyMode;
  conversationHistory?: ConversationMessage[] | string;
}

function isStudyMode(value: unknown): value is StudyMode {
  return value === "fun" || value === "balanced" || value === "focus";
}

function sanitizeHistory(history: unknown): ConversationMessage[] {
  if (typeof history === "string") {
    try {
      return sanitizeHistory(JSON.parse(history));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(history)) return [];

  return history
    .filter((item): item is ConversationMessage => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      const role = candidate["role"];
      const content = candidate["content"];
      return (
        (role === "user" || role === "assistant") &&
        typeof content === "string" &&
        content.trim().length > 0
      );
    })
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 2000),
    }));
}

function getTextField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function buildSystemPrompt({
  currentMode,
  subject,
  board,
}: {
  currentMode: StudyMode;
  subject?: string;
  board?: string;
}): string {
  const context: string[] = [];
  if (subject && subject !== "General") context.push(`Subject focus: ${subject}.`);
  if (board) context.push(`Board context: ${board}.`);
  const persona = getSubjectPersona(subject);

  return `You are a friendly, patient tutor helping a Matric-level (grade 9-10) student in Pakistan understand a topic. Explain in simple, clear language appropriate for their grade level - not university-level depth. Use short paragraphs, and if relevant, a simple example or analogy. If asked something unrelated to their studies, gently redirect them back to academics. Keep responses concise (aim for 100-200 words) since students are reading on mobile.
${context.length ? `\n${context.join("\n")}` : ""}
${persona ? `\n${persona}` : ""}
${
  currentMode === "focus"
    ? "\nBe direct and efficient - this student is close to exams and needs quick, exam-relevant answers, not lengthy tangents."
    : ""
}`;
}

function getTutorTextModel(subject?: string): string {
  return isUrduSubject(subject) ? DEEP_TEXT_MODEL : FAST_TEXT_MODEL;
}

function getFileKind(file: Express.Multer.File): UploadedFileKind {
  const name = file.originalname.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) return "image";
  if (file.mimetype === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (file.mimetype === "application/msword" || name.endsWith(".doc")) return "doc";
  return "unsupported";
}

async function extractDocumentText(file: Express.Multer.File, kind: "pdf" | "docx"): Promise<string> {
  if (kind === "pdf") {
    const result = await pdfParse(file.buffer);
    return result.text.trim();
  }

  const result = await mammoth.extractRawText({ buffer: file.buffer });
  return result.value.trim();
}

function buildDocumentPrompt({
  message,
  extractedText,
  truncated,
  fileName,
}: {
  message: string;
  extractedText: string;
  truncated: boolean;
  fileName: string;
}): string {
  const question = message || "No specific question was asked.";
  return `The student uploaded a document named "${fileName}". Here is its extracted content${truncated ? " (truncated to the first 4000 characters)" : ""}:

${extractedText}

Student message: ${question}

Answer their question about it. If no specific question was asked, summarize the key points relevant to their exam.`;
}

function runUpload(req: Request, res: Response, next: (err?: unknown) => void) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "File is too large. Please upload a file smaller than 10MB." });
        return;
      }
      res.status(400).json({ error: "Could not read the uploaded file. Please try again." });
      return;
    }

    if (err) {
      res.status(400).json({ error: "Upload failed. Please try again with a supported file." });
      return;
    }

    next();
  });
}

router.post("/tutor-chat", runUpload, async (req: Request, res: Response): Promise<void> => {
  const { message, subject, board, currentMode, conversationHistory } =
    req.body as TutorChatRequestBody;
  const uploadedFile = req.file;
  const trimmedMessage = typeof message === "string" ? message.trim() : "";

  if (!trimmedMessage && !uploadedFile) {
    res.status(400).json({ error: "Please type a question or attach a file." });
    return;
  }

  if (!isStudyMode(currentMode)) {
    res.status(400).json({ error: "currentMode must be fun, balanced, or focus" });
    return;
  }

  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY is not configured" });
    return;
  }

  const groq = new Groq({ apiKey });
  const safeHistory = sanitizeHistory(conversationHistory);
  const safeSubject = getTextField(subject);
  const textModel = getTutorTextModel(safeSubject);
  const systemPrompt = buildSystemPrompt({
    currentMode,
    subject: safeSubject,
    board: getTextField(board),
  });

  try {
    if (uploadedFile) {
      const kind = getFileKind(uploadedFile);

      if (kind === "unsupported") {
        res.status(415).json({
          error: "Unsupported file type. Please upload JPG, PNG, WEBP, PDF, or DOCX files.",
        });
        return;
      }

      if (kind === "doc") {
        res.status(415).json({
          error: "Legacy .doc files are not supported yet. Please convert it to .docx or PDF and upload again.",
        });
        return;
      }

      if (kind === "image") {
        const imageUrl = `data:${uploadedFile.mimetype};base64,${uploadedFile.buffer.toString("base64")}`;
        const completion = await groq.chat.completions.create({
          model: VISION_MODEL,
          temperature: currentMode === "focus" ? 0.2 : 0.45,
          max_tokens: 650,
          messages: [
            { role: "system", content: systemPrompt },
            ...safeHistory,
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${trimmedMessage || "Please solve/explain this question."}\n\nThe student has shared a photo of a question. Read the question/problem in the image and provide a clear, step-by-step explanation appropriate for a Matric-level student.`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ] as any,
        });

        const reply = completion.choices[0]?.message?.content?.trim();
        if (!reply) throw new Error("No tutor response was returned");
        res.json({ reply });
        return;
      }

      const extracted = await extractDocumentText(uploadedFile, kind);
      if (extracted.length < 40) {
        res.status(422).json({
          error: "This document has very little readable text. If it is scanned, try uploading a clear photo of the question instead.",
        });
        return;
      }

      const truncated = extracted.length > MAX_EXTRACTED_CHARS;
      const completion = await groq.chat.completions.create({
        model: textModel,
        temperature: currentMode === "focus" ? 0.2 : 0.45,
        max_tokens: 550,
        messages: [
          { role: "system", content: systemPrompt },
          ...safeHistory,
          {
            role: "user",
            content: buildDocumentPrompt({
              message: trimmedMessage,
              extractedText: extracted.slice(0, MAX_EXTRACTED_CHARS),
              truncated,
              fileName: uploadedFile.originalname,
            }),
          },
        ],
      });

      const reply = completion.choices[0]?.message?.content?.trim();
      if (!reply) throw new Error("No tutor response was returned");
      res.json({ reply });
      return;
    }

    const completion = await groq.chat.completions.create({
      model: textModel,
      temperature: currentMode === "focus" ? 0.2 : 0.45,
      max_tokens: 350,
      messages: [
        { role: "system", content: systemPrompt },
        ...safeHistory,
        { role: "user", content: trimmedMessage },
      ],
    });

    let reply = completion.choices[0]?.message?.content?.trim();
    if (reply && isUrduSubject(safeSubject) && hasInvalidUrduScript(reply)) {
      const corrected = await groq.chat.completions.create({
        model: DEEP_TEXT_MODEL,
        temperature: 0.15,
        max_tokens: 500,
        messages: [
          { role: "system", content: `${systemPrompt}\nYour previous draft used invalid non-Urdu script. Rewrite the answer using Urdu script only. No Devanagari, Chinese/Japanese characters, or Roman Urdu.` },
          ...safeHistory,
          { role: "user", content: trimmedMessage },
        ],
      });
      reply = corrected.choices[0]?.message?.content?.trim();
    }
    if (!reply) {
      throw new Error("No tutor response was returned");
    }

    res.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("invalid image data")) {
      res.status(422).json({
        error: "I could not read this image. Please upload a clear JPG, PNG, or WEBP photo of the question.",
      });
      return;
    }
    res.status(502).json({
      error: `Tutor chat failed: ${message}`,
    });
  }
});

export default router;
