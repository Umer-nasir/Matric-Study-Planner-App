import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { AlertCircle, BookOpen, CalendarCheck, ChevronDown, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAppContext } from '@/context/AppContext';
import { SYLLABUS_DATA } from '@/data/syllabusData';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/Button';
import { SubjectIcon } from '@/components/SubjectIcon';
import type { ChapterState } from '@/context/AppContext';
import { apiUrl } from '@/lib/api';
import {
  chapterDisplayName,
  subjectDirectionClass,
  subjectDisplayName,
  type SubjectStudyLanguage,
} from '@/lib/subjectLanguage';
import { containsUrduScript, rtlTextClass } from '@/lib/textDirection';

// ─── Animations ───────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
};

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      className={`w-11 h-11 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
        checked
          ? 'bg-primary border-primary'
          : 'border-border bg-background'
      }`}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
    >
      <AnimatePresence>
        {checked && (
          <motion.svg
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            viewBox="0 0 12 10"
            width="12"
            height="10"
            fill="none"
          >
            <motion.path
              d="M1 5l3.5 3.5L11 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─── Subject Card ─────────────────────────────────────────────────────────────

interface SubjectCardProps {
  subject: string;
  chapters: string[];
  completion: Record<string, ChapterState>;
  onToggle: (chapter: string) => void;
  onExplain: (subject: string, chapter: string) => void;
  needsPractice: Set<string>;
  subjectLanguages?: Record<string, SubjectStudyLanguage>;
}

interface ChapterExplanation {
  summary: string;
  keyPoints: string[];
  cachedAt: string;
}

interface SelectedChapter {
  subject: string;
  chapter: string;
}

type ExplanationState =
  | { key: string; status: 'idle'; explanation: null; error: null }
  | { key: string; status: 'loading'; explanation: ChapterExplanation | null; error: null }
  | { key: string; status: 'success'; explanation: ChapterExplanation; error: null }
  | { key: string; status: 'error'; explanation: null; error: string };

function explanationCacheKey(subject: string, chapter: string): string {
  const parts = [subject.trim(), chapter.trim()].map((part) => encodeURIComponent(part.toLocaleLowerCase()));
  return `matric_chapter_explanation_v5::${parts.join('::')}`;
}

function loadCachedExplanation(subject: string, chapter: string): ChapterExplanation | null {
  try {
    const key = explanationCacheKey(subject, chapter);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChapterExplanation;
    const text = `${parsed.summary}\n${parsed.keyPoints.join('\n')}`;
    if (containsUrduScript(text)) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function SubjectCard({ subject, chapters, completion, onToggle, onExplain, needsPractice, subjectLanguages }: SubjectCardProps) {
  const [open, setOpen] = useState(false);
  const displaySubject = subjectDisplayName(subject, subjectLanguages);

  const done = chapters.filter((ch) => completion[ch]?.done).length;
  const total = chapters.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden"
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {/* Icon */}
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
          <SubjectIcon subject={subject} className="h-5 w-5" />
        </div>

        {/* Name + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={`font-semibold text-foreground truncate ${subjectDirectionClass(subject, subjectLanguages)}`}>
              {displaySubject}
            </span>
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap flex-shrink-0">
              {done}/{total} · {pct}%
            </span>
          </div>
          <ProgressBar percentage={pct} height="h-1.5" />
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="flex-shrink-0 ml-1"
        >
          <ChevronDown size={18} className="text-muted-foreground" />
        </motion.div>
      </button>

      {/* Chapter list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="chapters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.8 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-border px-4 py-2 space-y-1">
              {chapters.map((chapter) => {
                const chapterState = completion[chapter] ?? { done: false, selectedForSchedule: true };
                const isChecked = chapterState.done;
                const displayChapter = chapterDisplayName(subject, chapter, subjectLanguages);
                return (
                  <div
                    key={chapter}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <Checkbox
                      checked={isChecked}
                      onToggle={() => onToggle(chapter)}
                    />
                    <button
                      type="button"
                      onClick={() => onExplain(subject, chapter)}
                      className="flex min-h-[44px] min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-2 py-1 text-left transition-colors active:bg-secondary"
                      aria-label={`Open explanation for ${displayChapter}`}
                    >
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-sm font-semibold leading-snug transition-colors duration-200 ${subjectDirectionClass(subject, subjectLanguages)} ${
                            isChecked
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground underline decoration-primary/25 underline-offset-4'
                          }`}
                        >
                          {displayChapter}
                        </span>
                        {!isChecked && chapterState.selectedForSchedule && (
                          <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary">
                            <CalendarCheck size={11} />
                            In plan
                          </span>
                        )}
                        {needsPractice.has(chapter) && (
                          <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                            <AlertCircle size={11} />
                            Needs practice
                          </span>
                        )}
                      </div>
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                        aria-hidden="true"
                      >
                        <Info size={15} />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer summary */}
            <div className="px-4 py-3 border-t border-border bg-secondary/30">
              <p className="text-xs text-muted-foreground text-center">
                {done === total
                  ? '🎉 All chapters done!'
                  : `${total - done} chapter${total - done !== 1 ? 's' : ''} remaining`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Syllabus() {
  const { profile, chapterCompletion, toggleChapter, overallProgress, practiceHistory } = useAppContext();
  const [, setLocation] = useLocation();
  const [selectedChapter, setSelectedChapter] = useState<SelectedChapter | null>(null);
  const [explanationState, setExplanationState] = useState<ExplanationState | null>(null);
  const activeRequestRef = useRef<{ key: string; id: number; controller: AbortController } | null>(null);
  const requestIdRef = useRef(0);

  function abortActiveExplanationRequest() {
    activeRequestRef.current?.controller.abort();
    activeRequestRef.current = null;
  }

  useEffect(() => () => abortActiveExplanationRequest(), []);

  // Sort subjects by least progress first
  const sortedSubjects = useMemo(() => {
    if (!profile) return [];
    return [...profile.subjects].sort((a, b) => {
      const chapA = SYLLABUS_DATA[a] ?? [];
      const chapB = SYLLABUS_DATA[b] ?? [];
      const pctA = chapA.length === 0 ? 0 : chapA.filter((c) => chapterCompletion[a]?.[c]?.done).length / chapA.length;
      const pctB = chapB.length === 0 ? 0 : chapB.filter((c) => chapterCompletion[b]?.[c]?.done).length / chapB.length;
      return pctA - pctB;
    });
  }, [profile, chapterCompletion]);

  const lowScoreChapters = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    for (const attempt of practiceHistory) {
      if (attempt.total <= 0) continue;
      const pct = attempt.score / attempt.total;
      if (pct >= 0.6) continue;
      if (!result[attempt.subject]) result[attempt.subject] = new Set();
      result[attempt.subject].add(attempt.chapter);
    }
    return result;
  }, [practiceHistory]);

  if (!profile) return null;

  function closeExplanation() {
    abortActiveExplanationRequest();
    setSelectedChapter(null);
    setExplanationState(null);
  }

  function openExplanation(subject: string, chapter: string) {
    setSelectedChapter({ subject, chapter });
    const key = explanationCacheKey(subject, chapter);
    abortActiveExplanationRequest();
    const cached = loadCachedExplanation(subject, chapter);
    if (cached) {
      setExplanationState({ key, status: 'success', explanation: cached, error: null });
      return;
    }
    setExplanationState({ key, status: 'idle', explanation: null, error: null });
    void fetchExplanation(subject, chapter, false);
  }

  async function fetchExplanation(subject: string, chapter: string, refresh: boolean) {
    if (!profile) return;
    const key = explanationCacheKey(subject, chapter);
    const requestId = requestIdRef.current + 1;
    const controller = new AbortController();
    requestIdRef.current = requestId;

    abortActiveExplanationRequest();
    activeRequestRef.current = { key, id: requestId, controller };

    setExplanationState((current) => ({
      key,
      status: 'loading',
      explanation: refresh || current?.key !== key ? null : current.explanation,
      error: null,
    }));

    const isCurrentRequest = () =>
      activeRequestRef.current?.key === key &&
      activeRequestRef.current.id === requestId &&
      !controller.signal.aborted;

    try {
      const res = await fetch(apiUrl('/api/explain-chapter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          subject,
          chapter,
          board: profile.board,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        summary?: string;
        keyPoints?: string[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Could not load explanation.');
      }
      const next: ChapterExplanation = {
        summary: data.summary ?? '',
        keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
        cachedAt: new Date().toISOString(),
      };
      const text = `${next.summary}\n${next.keyPoints.join('\n')}`;
      if (containsUrduScript(text)) {
        throw new Error('The explanation came back in a non-English script. Please tap refresh and try again.');
      }
      localStorage.setItem(explanationCacheKey(subject, chapter), JSON.stringify(next));
      if (isCurrentRequest()) {
        setExplanationState({ key, status: 'success', explanation: next, error: null });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (isCurrentRequest()) {
        setExplanationState({
          key,
          status: 'error',
          explanation: null,
          error: err instanceof Error ? err.message : "Couldn't load explanation right now, try again.",
        });
      }
    } finally {
      if (isCurrentRequest()) {
        activeRequestRef.current = null;
      }
    }
  }

  const selectedExplanationKey = selectedChapter
    ? explanationCacheKey(selectedChapter.subject, selectedChapter.chapter)
    : null;
  const currentExplanationState =
    selectedExplanationKey && explanationState?.key === selectedExplanationKey ? explanationState : null;
  const explanation = currentExplanationState?.explanation ?? null;
  const isExplanationLoading = currentExplanationState?.status === 'loading';
  const explanationError = currentExplanationState?.status === 'error' ? currentExplanationState.error : null;

  return (
    <div className="min-h-[100dvh] max-w-[480px] mx-auto pb-24 bg-background shadow-[0_0_40px_rgba(0,0,0,0.05)]">
      <motion.div
        className="px-5 pt-8 pb-6 space-y-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={cardVariants}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Syllabus Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Check off chapters as you revise them.
          </p>
        </motion.div>

        {/* Overall progress card */}
        <motion.div
          variants={cardVariants}
          className="rounded-2xl bg-card border border-border shadow-sm p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Overall Progress</span>
            <span className="text-sm font-bold text-primary">{overallProgress}%</span>
          </div>
          <ProgressBar percentage={overallProgress} height="h-3" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {overallProgress === 0
              ? 'Start checking off chapters below 👇'
              : overallProgress === 100
              ? '🏆 Entire syllabus complete!'
              : `Keep going — you're ${overallProgress}% through the syllabus`}
          </p>
        </motion.div>

        {/* Subject accordion cards */}
        <div className="space-y-3">
          {sortedSubjects.map((subject) => (
            <SubjectCard
              key={subject}
              subject={subject}
              chapters={SYLLABUS_DATA[subject] ?? []}
              completion={chapterCompletion[subject] ?? {}}
              onToggle={(chapter) => toggleChapter(subject, chapter)}
              onExplain={openExplanation}
              needsPractice={lowScoreChapters[subject] ?? new Set()}
              subjectLanguages={profile.subjectLanguages}
            />
          ))}
        </div>
      </motion.div>
      <AnimatePresence>
        {selectedChapter && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeExplanation}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="mb-3 max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {subjectDisplayName(selectedChapter.subject, profile.subjectLanguages)}
                  </p>
                  <h2 className={`mt-1 text-xl font-black leading-tight text-foreground ${subjectDirectionClass(selectedChapter.subject, profile.subjectLanguages)}`}>
                    {chapterDisplayName(selectedChapter.subject, selectedChapter.chapter, profile.subjectLanguages)}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {explanation && (
                    <button
                      type="button"
                      onClick={() => void fetchExplanation(selectedChapter.subject, selectedChapter.chapter, true)}
                      disabled={isExplanationLoading}
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground disabled:opacity-60"
                      aria-label="Refresh chapter explanation"
                    >
                      <RefreshCw size={17} className={isExplanationLoading ? 'animate-spin' : ''} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeExplanation}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
                    aria-label="Close chapter explanation"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {isExplanationLoading && !explanation && (
                <div className="rounded-2xl bg-secondary p-5 text-center">
                  <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-primary" />
                  <p className="font-semibold text-foreground">Loading key points...</p>
                  <p className="mt-1 text-sm text-muted-foreground">This should only take a moment.</p>
                </div>
              )}

              {explanationError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    {explanationError}
                  </p>
                  <Button
                    className="mt-3"
                    variant="outline"
                    fullWidth
                    onClick={() => void fetchExplanation(selectedChapter.subject, selectedChapter.chapter, false)}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {explanation && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3 flex items-center gap-2 text-primary">
                      <BookOpen size={18} />
                      <p className="text-sm font-black">Key points</p>
                    </div>
                    <div className="space-y-2">
                      {(explanation.keyPoints.length ? explanation.keyPoints : [explanation.summary]).map((point, index) => (
                        <div
                          key={`${point}-${index}`}
                          className={`flex gap-3 rounded-2xl bg-secondary p-3 ${rtlTextClass(point)}`}
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-foreground">{point}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Saved for quick reopening
                    </p>
                  </div>

                  <Button
                    fullWidth
                    onClick={() => {
                      const params = new URLSearchParams({
                        subject: selectedChapter.subject,
                        chapter: selectedChapter.chapter,
                      });
                      closeExplanation();
                      setLocation(`/practice?${params.toString()}`);
                    }}
                  >
                    Practice this chapter
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
