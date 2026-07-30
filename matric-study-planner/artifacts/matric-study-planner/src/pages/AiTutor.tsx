import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, FileText, Paperclip, Send, Sparkles, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ModeIndicator } from '@/components/ModeIndicator';
import { useAppContext } from '@/context/AppContext';
import type { TutorChatMessage } from '@/context/AppContext';
import { apiUrl } from '@/lib/api';
import {
  subjectDisplayName,
  subjectStarterQuestions,
} from '@/lib/subjectLanguage';
import { rtlTextClass } from '@/lib/textDirection';

type TutorApiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type PendingAttachment = {
  file: File;
  name: string;
  kind: 'image' | 'document';
  mimeType: string;
  previewUrl?: string;
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function createMessage(
  role: TutorChatMessage['role'],
  content: string,
  attachment?: TutorChatMessage['attachment'],
): TutorChatMessage {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    attachment,
  };
}

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    ACCEPTED_ATTACHMENT_TYPES.includes(file.type) ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.pdf') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  );
}

function getAttachmentKind(file: File): PendingAttachment['kind'] {
  return file.type.startsWith('image/') ? 'image' : 'document';
}

function getInstantTutorReply(message: string): string | null {
  const normalized = message.trim().toLowerCase().replace(/[!.?]+$/g, '');
  if (!/^(hi|hello|hey|salam|assalamualaikum|assalamu alaikum)$/.test(normalized)) {
    return null;
  }

  return 'Hi! Ask me any Matric question and I will keep the answer clear and exam-focused.';
}
function createImageThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not preview this image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not preview this image.'));
      image.onload = () => {
        const maxSize = 240;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not preview this image.'));
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function uploadTutorRequest(
  formData: FormData,
  onProgress: (progress: number) => void,
): Promise<{ reply?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl('/api/tutor-chat'));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(95, Math.round((event.loaded / event.total) * 90)));
      } else {
        onProgress(35);
      }
    };
    xhr.onload = () => {
      let data: { reply?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText || '{}') as { reply?: string; error?: string };
      } catch {
        const isHtmlError = xhr.responseText.trim().startsWith('<!DOCTYPE html');
        data = {
          error: isHtmlError
            ? 'The AI tutor is not connected correctly right now. Please try again in a moment.'
            : 'The AI tutor had trouble reading that response. Please try again.',
        };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(data);
      } else {
        reject(new Error(data.error ?? 'The tutor could not answer right now.'));
      }
    };
    xhr.onerror = () => reject(new Error('I could not reach the AI tutor right now. Please try again in a moment.'));
    xhr.send(formData);
  });
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-md bg-card border border-border px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary"
                animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            Preparing exam-focused answer...
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: TutorChatMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const textDirectionClass = rtlTextClass(message.content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${textDirectionClass} ${
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : isSystem
            ? 'rounded-bl-md border border-amber-200 bg-amber-50 text-amber-900'
            : 'rounded-bl-md border border-border bg-card text-foreground'
        }`}
      >
        {message.attachment && (
          <div className={message.content ? 'mb-2' : ''}>
            {message.attachment.kind === 'image' && message.attachment.previewUrl ? (
              <img
                src={message.attachment.previewUrl}
                alt={message.attachment.name}
                className="max-h-36 w-full rounded-xl object-cover"
              />
            ) : (
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  isUser ? 'bg-white/15' : 'bg-secondary'
                }`}
              >
                <FileText size={16} className="shrink-0" />
                <span className="min-w-0 truncate text-xs font-semibold">
                  {message.attachment.name}
                </span>
              </div>
            )}
          </div>
        )}
        {message.content}
      </div>
    </motion.div>
  );
}

export default function AiTutor() {
  const {
    currentMode,
    profile,
    tutorChatHistory,
    setTutorChatHistory,
  } = useAppContext();
  const isFocus = currentMode === 'focus';
  const [selectedSubject, setSelectedSubject] = useState('General');
  const [draft, setDraft] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const subjectOptions = useMemo(
    () => ['General', ...(profile?.subjects ?? [])],
    [profile?.subjects],
  );
  const starterQuestions = useMemo(
    () => subjectStarterQuestions(selectedSubject, profile?.subjectLanguages),
    [profile?.subjectLanguages, selectedSubject],
  );

  useEffect(() => {
    if (!subjectOptions.includes(selectedSubject)) {
      setSelectedSubject('General');
    }
  }, [selectedSubject, subjectOptions]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [tutorChatHistory, isSending]);

  async function sendMessage(rawMessage: string, attachment = pendingAttachment) {
    const trimmed = rawMessage.trim();
    if ((!trimmed && !attachment) || isSending) return;

    const attachmentMeta = attachment
      ? {
          name: attachment.name,
          kind: attachment.kind,
          mimeType: attachment.mimeType,
          previewUrl: attachment.previewUrl,
        }
      : undefined;
    const userMessage = createMessage(
      'user',
      trimmed || `Uploaded ${attachment?.name}`,
      attachmentMeta,
    );
    const optimisticHistory = [...tutorChatHistory, userMessage];
    setTutorChatHistory(optimisticHistory);
    setDraft('');
    setPendingAttachment(null);
    setAttachmentError(null);

    const instantReply = !attachment ? getInstantTutorReply(trimmed) : null;
    if (instantReply) {
      setTutorChatHistory([
        ...optimisticHistory,
        createMessage('assistant', instantReply),
      ]);
      return;
    }

    setUploadProgress(attachment ? 5 : null);
    setIsSending(true);

    const conversationHistory: TutorApiMessage[] = tutorChatHistory
      .filter((message): message is TutorChatMessage & { role: 'user' | 'assistant' } =>
        message.role === 'user' || message.role === 'assistant',
      )
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    try {
      let data: { reply?: string; error?: string };
      if (attachment) {
        const formData = new FormData();
        formData.append('message', trimmed);
        formData.append('currentMode', currentMode);
        formData.append('conversationHistory', JSON.stringify(conversationHistory));
        formData.append('file', attachment.file);
        if (selectedSubject !== 'General') formData.append('subject', selectedSubject);
        if (profile?.board) formData.append('board', profile.board);
        data = await uploadTutorRequest(formData, setUploadProgress);
      } else {
        const res = await fetch(apiUrl('/api/tutor-chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            subject: selectedSubject === 'General' ? undefined : selectedSubject,
            board: profile?.board,
            currentMode,
            conversationHistory,
          }),
        });

        data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? 'The tutor could not answer right now.');
        }
      }

      if (!data.reply) {
        throw new Error(data.error ?? 'The tutor could not answer right now.');
      }

      setTutorChatHistory([
        ...optimisticHistory,
        createMessage('assistant', data.reply),
      ]);
    } catch (err) {
      setTutorChatHistory([
        ...optimisticHistory,
        createMessage(
          'system',
          err instanceof Error
            ? err.message.replace(/^.*fetch.*$/i, 'AI is busy right now. Try again in a moment.')
            : 'AI is busy right now. Try again in a moment.',
        ),
      ]);
    } finally {
      setIsSending(false);
      setUploadProgress(null);
    }
  }

  async function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setAttachmentError(null);
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError('File is too large. Please upload a file smaller than 10MB.');
      return;
    }

    if (!isAcceptedFile(file)) {
      setAttachmentError('Unsupported file type. Please upload JPG, PNG, WEBP, PDF, DOC, or DOCX.');
      return;
    }

    const kind = getAttachmentKind(file);
    try {
      const previewUrl = kind === 'image' ? await createImageThumbnail(file) : undefined;
      setPendingAttachment({
        file,
        name: file.name,
        kind,
        mimeType: file.type || 'application/octet-stream',
        previewUrl,
      });
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Could not preview this file.');
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  return (
    <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.05)]">
      <div className="sticky top-0 z-20 bg-card border-b border-border px-5 pt-8 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Tutor</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isFocus ? 'Quick answers mode' : 'Ask for clear, exam-focused help.'}
            </p>
          </div>
          <ModeIndicator />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <BookOpen size={14} />
            Ask about
          </label>
          <div className="relative">
            <select
              value={selectedSubject}
              onChange={(event) => setSelectedSubject(event.target.value)}
              className="min-h-[44px] appearance-none rounded-2xl border border-border bg-background py-2 pl-3 pr-8 text-xs font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Select tutor subject"
            >
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject === 'General' ? 'General' : subjectDisplayName(subject, profile?.subjectLanguages)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-44">
        {isFocus && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            <Zap size={14} />
            Quick answers mode
          </div>
        )}

        {tutorChatHistory.length === 0 ? (
          <div className="flex min-h-[52dvh] flex-col items-center justify-center text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${
                isFocus ? 'bg-red-50' : 'bg-primary/10'
              }`}
            >
              {isFocus ? (
                <Zap className="text-red-600" size={28} />
              ) : (
                <Sparkles className="text-primary" size={28} />
              )}
            </motion.div>

            <h3 className="mb-2 text-lg font-semibold text-foreground">
              {isFocus ? 'Ask your question below' : 'Hi! Ask me anything about your subjects'}
            </h3>
            <p className="max-w-[300px] text-sm text-muted-foreground">
              {isFocus
                ? 'Get a short, exam-relevant explanation and move on to practice.'
                : 'I can explain concepts, summarize chapters, or help you revise tricky topics.'}
            </p>

            {!isFocus && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {starterQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    className="rounded-full border border-primary/20 bg-primary/8 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {tutorChatHistory.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
            {isSending && <TypingIndicator />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-0 right-0 z-40 mx-auto max-w-[480px] border-t border-border bg-card p-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleAttachmentChange}
          aria-label="Attach a file"
        />

        <AnimatePresence>
          {pendingAttachment && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-3 rounded-2xl border border-border bg-background p-2"
            >
              <div className="flex items-center gap-3">
                {pendingAttachment.kind === 'image' && pendingAttachment.previewUrl ? (
                  <img
                    src={pendingAttachment.previewUrl}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <FileText size={20} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {pendingAttachment.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ready to send
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingAttachment(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Remove attachment"
                  disabled={isSending}
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {attachmentError && (
          <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            {attachmentError}
          </p>
        )}

        {uploadProgress !== null && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Uploading and processing...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${uploadProgress}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              />
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
            aria-label="Attach image or document"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(draft);
              }
            }}
            rows={1}
            placeholder={isFocus ? 'Ask exam question...' : 'Ask a question...'}
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={(!draft.trim() && !pendingAttachment) || isSending}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
