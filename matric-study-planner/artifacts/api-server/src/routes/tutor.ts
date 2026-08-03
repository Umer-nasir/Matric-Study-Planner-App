import { createRequire } from "node:module";
import { Router, type IRouter, type Request, type Response } from "express";
import mammoth from "mammoth";
import multer from "multer";
import type pdfParseType from "pdf-parse";
import { hasUrduScript } from "../config/genericAi";
import { getSubjectPersona } from "../config/subjectPersonas";

const router: IRouter = Router();
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as typeof pdfParseType;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 4000;
const GEMINI_TUTOR_MODEL = process.env["GEMINI_TUTOR_MODEL"] ?? "gemini-2.5-flash";

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

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
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
  const personaMatch = getSubjectPersona(subject);

  return `You are a friendly, patient tutor helping a Matric-level (grade 9-10) student in Pakistan understand a topic. Explain in simple, clear language appropriate for their grade level - not university-level depth. Use short paragraphs, and if relevant, a simple example or analogy. If asked something unrelated to their studies, gently redirect them back to academics. Keep responses concise (aim for 100-200 words) since students are reading on mobile.
${context.length ? `\n${context.join("\n")}` : ""}
${personaMatch.persona}
${personaMatch.languageInstruction}
${
  currentMode === "focus"
    ? "\nBe direct and efficient - this student is close to exams and needs quick, exam-relevant answers, not lengthy tangents."
    : ""
}`;
}

function getInstantTutorReply(message: string): string | null {
  const normalized = message.trim().toLowerCase().replace(/[!.?]+$/g, "");
  if (!/^(hi|hello|hey|salam|assalamualaikum|assalamu alaikum)$/.test(normalized)) {
    return null;
  }

  return "Hi! Ask me any Matric question and I will keep the answer clear and exam-focused.";
}

function getInstantUrduTutorReply(message: string): string | null {
  const normalized = message.trim().toLowerCase().replace(/[!.?]+$/g, "");
  if (!/^(hi|hello|hey|salam|assalamualaikum|assalamu alaikum)$/.test(normalized)) {
    return null;
  }

  return "وعلیکم السلام! اردو کے کسی بھی سبق، تشریح، خط یا درخواست کے بارے میں سوال پوچھیں۔";
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

function geminiHistoryFromConversation(history: ConversationMessage[]): GeminiContent[] {
  return history.map((item) => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{ text: item.content }],
  }));
}

function readGeminiText(data: GeminiGenerateResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((part) => part.text)
    .filter((part): part is string => typeof part === "string")
    .join("")
    .trim();
  return text || null;
}

async function generateGeminiTutorReply({
  apiKey,
  model,
  systemPrompt,
  contents,
  temperature,
  maxOutputTokens,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  contents: GeminiContent[];
  temperature: number;
  maxOutputTokens: number;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as GeminiGenerateResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini request failed with status ${response.status}`);
  }

  const reply = readGeminiText(data);
  if (!reply) throw new Error("No tutor response was returned");
  return reply;
}

async function ensureEnglishReply({
  apiKey,
  model,
  systemPrompt,
  originalUserContent,
  reply,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  originalUserContent: string;
  reply: string;
}): Promise<string> {
  if (!hasUrduScript(reply)) return reply;

  return generateGeminiTutorReply({
    apiKey,
    model,
    temperature: 0,
    maxOutputTokens: 650,
    systemPrompt: `${systemPrompt}\nTranslate the assistant draft into simple English only. Keep the meaning, remove all Urdu/Arabic script, and respond with the final answer only.`,
    contents: [
      {
        role: "user",
        parts: [{ text: `Student request:\n${originalUserContent}\n\nAssistant draft to convert to English:\n${reply}` }],
      },
    ],
  });
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
  const { message, subject, board, currentMode, conversationHistory } = req.body as TutorChatRequestBody;
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

  const safeSubject = getTextField(subject);
  const personaMatch = getSubjectPersona(safeSubject);
  console.log(`[subject-persona] /api/tutor-chat subject="${safeSubject ?? ""}" matched="${personaMatch.key}"`);

  if (!uploadedFile) {
    const instantReply = personaMatch.expectsUrduScript
      ? getInstantUrduTutorReply(trimmedMessage)
      : getInstantTutorReply(trimmedMessage);
    if (instantReply) {
      res.json({ reply: instantReply });
      return;
    }
  }

  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    return;
  }

  const safeHistory = sanitizeHistory(conversationHistory);
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
        let reply = await generateGeminiTutorReply({
          apiKey,
          model: GEMINI_TUTOR_MODEL,
          temperature: currentMode === "focus" ? 0.2 : 0.45,
          maxOutputTokens: 650,
          systemPrompt,
          contents: [
            ...geminiHistoryFromConversation(safeHistory),
            {
              role: "user",
              parts: [
                { text: `${trimmedMessage || "Please solve/explain this question."}\n\nThe student has shared a photo of a question. Read the question/problem in the image and provide a clear, step-by-step explanation appropriate for a Matric-level student.` },
                {
                  inlineData: {
                    mimeType: uploadedFile.mimetype,
                    data: uploadedFile.buffer.toString("base64"),
                  },
                },
              ],
            },
          ],
        });
        if (!personaMatch.expectsUrduScript) {
          reply = await ensureEnglishReply({
            apiKey,
            model: GEMINI_TUTOR_MODEL,
            systemPrompt,
            originalUserContent: trimmedMessage || "Please solve/explain this question from the uploaded image.",
            reply,
          });
        }
        if (!personaMatch.expectsUrduScript && hasUrduScript(reply)) {
          res.status(422).json({ error: "The AI returned a non-English tutor response. Please retry." });
          return;
        }
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
      const documentPrompt = buildDocumentPrompt({
        message: trimmedMessage,
        extractedText: extracted.slice(0, MAX_EXTRACTED_CHARS),
        truncated,
        fileName: uploadedFile.originalname,
      });
      let reply = await generateGeminiTutorReply({
        apiKey,
        model: GEMINI_TUTOR_MODEL,
        temperature: currentMode === "focus" ? 0.2 : 0.45,
        maxOutputTokens: 550,
        systemPrompt,
        contents: [
          ...geminiHistoryFromConversation(safeHistory),
          {
            role: "user",
            parts: [{ text: documentPrompt }],
          },
        ],
      });

      if (!personaMatch.expectsUrduScript) {
        reply = await ensureEnglishReply({
          apiKey,
          model: GEMINI_TUTOR_MODEL,
          systemPrompt,
          originalUserContent: documentPrompt,
          reply,
        });
      }
      if (!personaMatch.expectsUrduScript && hasUrduScript(reply)) {
        res.status(422).json({ error: "The AI returned a non-English tutor response. Please retry." });
        return;
      }
      res.json({ reply });
      return;
    }

    let reply = await generateGeminiTutorReply({
      apiKey,
      model: GEMINI_TUTOR_MODEL,
      temperature: currentMode === "focus" ? 0.2 : 0.45,
      maxOutputTokens: 350,
      systemPrompt,
      contents: [
        ...geminiHistoryFromConversation(safeHistory),
        { role: "user", parts: [{ text: trimmedMessage }] },
      ],
    });

    if (!personaMatch.expectsUrduScript) {
      reply = await ensureEnglishReply({
        apiKey,
        model: GEMINI_TUTOR_MODEL,
        systemPrompt,
        originalUserContent: trimmedMessage,
        reply,
      });
    }
    if (!personaMatch.expectsUrduScript && hasUrduScript(reply)) {
      res.status(422).json({ error: "The AI returned a non-English tutor response. Please retry." });
      return;
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
