import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Award, PartyPopper, BookCheck, RefreshCw, ChevronDown, Clock, AlertCircle, Sparkles, Calendar, CalendarCheck, X, Bell, Download, FileText } from 'lucide-react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressRing } from '@/components/ProgressRing';
import { ProgressBar } from '@/components/ProgressBar';
import { ModeBanner } from '@/components/ModeBanner';
import { ModeIndicator } from '@/components/ModeIndicator';
import { StreakCounter } from '@/components/StreakCounter';
import { Mascot } from '@/components/Mascot';
import { MiniCalendar } from '@/components/MiniCalendar';
import { SubjectIcon } from '@/components/SubjectIcon';
import { useAppContext } from '@/context/AppContext';
import { SYLLABUS_DATA } from '@/data/syllabusData';
import { MILESTONES } from '@/data/milestones';
import { getDailyQuote } from '@/data/quotes';
import { apiUrl } from '@/lib/api';
import {
  daysUntilDateOnly,
  examDateToLocalDate,
  todayDateOnly,
} from '@/lib/dateOnly';
import { getTimeGreeting } from '@/lib/timeGreeting';
import {
  chapterDisplayName,
  subjectDirectionClass,
  subjectDisplayName,
  subjectNameDirectionClass,
} from '@/lib/subjectLanguage';
import type { ChapterCompletion, ChapterState, Profile } from '@/context/AppContext';
import type { ScheduleDay } from '@/types/schedule';

// ── Animation variants ────────────────────────────────────────────────────────

const containerVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const cardVariants: Variants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } } };
const focusContainer: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0 } } };
const focusCard: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } };

// ── Fallback task generation ──────────────────────────────────────────────────

interface DayTask { subject: string; chapter: string; durationMinutes?: number }

function getChapterState(state: ChapterState | undefined): ChapterState {
  return state ?? { done: false, selectedForSchedule: true };
}

function generateFallbackTasks(
  subjects: string[],
  chapterCompletion: ChapterCompletion,
  daysLeft: number,
): DayTask[] {
  const subjectData = subjects.map((subject) => {
    const chapters = SYLLABUS_DATA[subject] ?? [];
    const done = chapters.filter((ch) => chapterCompletion[subject]?.[ch]?.done).length;
    const pct = chapters.length === 0 ? 100 : (done / chapters.length) * 100;
    const incomplete = chapters.filter((ch) => {
      const state = chapterCompletion[subject]?.[ch];
      const chapterState = getChapterState(state);
      return !chapterState.done && chapterState.selectedForSchedule;
    });
    return { subject, pct, incomplete };
  });
  subjectData.sort((a, b) => a.pct - b.pct);
  const totalIncomplete = subjectData.reduce((s, d) => s + d.incomplete.length, 0);
  if (totalIncomplete === 0) return [];
  const pool: DayTask[] = [];
  for (const { subject, pct, incomplete } of subjectData) {
    if (incomplete.length === 0) continue;
    const slots = pct < 30 ? 3 : pct < 60 ? 2 : 1;
    for (let i = 0; i < slots && i < incomplete.length; i++) {
      pool.push({ subject, chapter: incomplete[i] });
    }
  }
  const safedays = Math.max(1, daysLeft);
  const dailyRate = Math.ceil(totalIncomplete / safedays);
  return pool.slice(0, Math.min(Math.max(dailyRate, 2), 6));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function buildCanvasPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create PDF image.')), 'image/jpeg', 0.92);
  });
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const offsets = [0];
  let byteLength = 0;
  const append = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    parts.push(bytes as BlobPart);
    byteLength += bytes.byteLength;
  };
  const addObject = (id: number, body: string | Uint8Array, prefix = '', suffix = '') => {
    offsets[id] = byteLength;
    append(`${id} 0 obj\n${prefix}`);
    append(body);
    append(`${suffix}\nendobj\n`);
  };

  append('%PDF-1.4\n');
  addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  addObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  addObject(
    4,
    jpeg,
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`,
    '\nendstream',
  );
  const draw = 'q\n612 0 0 765 0 13.5 cm\n/Im0 Do\nQ';
  addObject(5, draw, `<< /Length ${encoder.encode(draw).byteLength} >>\nstream\n`, '\nendstream');

  const xrefOffset = byteLength;
  append('xref\n0 6\n0000000000 65535 f \n');
  for (let id = 1; id <= 5; id += 1) append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  append(`trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

// ── Task checkbox ─────────────────────────────────────────────────────────────

function TaskCheckbox({
  checked,
  subject,
  onToggle,
  compact = false,
}: {
  checked: boolean;
  subject: string;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <motion.button
      onClick={onToggle}
      className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        compact ? 'h-6 w-6' : 'h-8 w-8'
      } ${
        checked
          ? 'border-primary bg-primary text-primary-foreground shadow-primary/20'
          : 'border-slate-200 bg-slate-50 text-transparent hover:border-primary/30 hover:bg-primary/5'
      }`}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.04 }}
      aria-label={checked ? `Mark ${subject} incomplete` : `Mark ${subject} complete`}
    >
      <AnimatePresence>
        {checked ? (
          <motion.svg
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            viewBox="0 0 12 10" width={compact ? '10' : '12'} height={compact ? '8' : '10'} fill="none"
          >
            <motion.path
              d="M1 5l3.5 3.5L11 1"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
          </motion.svg>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Weekly View ───────────────────────────────────────────────────────────────

function WeeklyView({
  days,
  chapterCompletion,
  toggleChapter,
  isFocus,
}: {
  days: ScheduleDay[];
  chapterCompletion: ChapterCompletion;
  toggleChapter: (subject: string, chapter: string) => void;
  isFocus: boolean;
}) {
  const todayStr = todayDateOnly();
  const [openDay, setOpenDay] = useState<string | null>(todayStr);

  return (
    <div className="space-y-2">
      {days.map((day) => {
        const isToday = day.date === todayStr;
        const isPast = day.date < todayStr;
        const isOpen = openDay === day.date;
        const allDone = day.blocks.length > 0 && day.blocks.every(
          (b) => getChapterState(chapterCompletion[b.subject]?.[b.chapter]).done,
        );

        return (
          <div
            key={day.date}
            className={`rounded-2xl border overflow-hidden transition-colors ${
              isToday
                ? 'border-primary/40 bg-primary/5'
                : isPast
                ? 'border-border bg-secondary/30 opacity-70'
                : 'border-border bg-card'
            }`}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              onClick={() => setOpenDay(isOpen ? null : day.date)}
            >
              {/* Day label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                    {isToday ? 'Today' : day.day}
                  </span>
                  {isToday && (
                    <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full font-semibold">NOW</span>
                  )}
                  {allDone && <span className="text-[10px] text-emerald-600 font-semibold">✓ Done</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(day.date + 'T00:00:00'), 'dd MMM')} · {day.blocks.length} block{day.blocks.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Subject icons preview */}
              <div className="flex gap-1 items-center flex-shrink-0">
                {[...new Set(day.blocks.map((b) => b.subject))].slice(0, 3).map((subj) => (
                  <SubjectIcon key={subj} subject={subj} className="h-4 w-4" />
                ))}
              </div>

              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex-shrink-0"
              >
                <ChevronDown size={16} className="text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.8 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="border-t border-border divide-y divide-border">
                    {day.blocks.map((block, i) => {
                      const checked = getChapterState(chapterCompletion[block.subject]?.[block.chapter]).done;
                      const displaySubject = subjectDisplayName(block.subject);
                      const displayChapter = chapterDisplayName(block.subject, block.chapter);
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <TaskCheckbox
                            checked={checked}
                            subject={block.subject}
                            onToggle={() => toggleChapter(block.subject, block.chapter)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-snug ${subjectDirectionClass(block.subject)} ${
                              checked ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}>
                              {displayChapter}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <span className={subjectNameDirectionClass(block.subject)}>{displaySubject}</span>
                              <span className="flex items-center gap-0.5">
                                <Clock size={10} />
                                {block.durationMinutes}m
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function ChapterSelectionModal({
  subjects,
  chapterCompletion,
  selectedCount,
  onClose,
  onGenerate,
  onToggleChapter,
  onSetSubjectSelection,
  isGenerating,
}: {
  subjects: string[];
  chapterCompletion: ChapterCompletion;
  selectedCount: number;
  onClose: () => void;
  onGenerate: () => void;
  onToggleChapter: (subject: string, chapter: string) => void;
  onSetSubjectSelection: (subject: string, selected: boolean) => void;
  isGenerating: boolean;
}) {
  const [openSubject, setOpenSubject] = useState<string | null>(subjects[0] ?? null);

  const selectedSubjectCount = subjects.filter((subject) =>
    (SYLLABUS_DATA[subject] ?? []).some((chapter) => {
      const state = getChapterState(chapterCompletion[subject]?.[chapter]);
      return !state.done && state.selectedForSchedule;
    }),
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 px-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-selection-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="flex max-h-[88dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="chapter-selection-title" className="text-lg font-bold text-foreground">
              Select Chapters
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pick chapters for this week's AI plan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground hover:bg-secondary"
            aria-label="Close chapter selection"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {subjects.map((subject) => {
            const displaySubject = subjectDisplayName(subject);
            const incomplete = (SYLLABUS_DATA[subject] ?? []).filter(
              (chapter) => !getChapterState(chapterCompletion[subject]?.[chapter]).done,
            );
            const selectedInSubject = incomplete.filter(
              (chapter) => getChapterState(chapterCompletion[subject]?.[chapter]).selectedForSchedule,
            ).length;
            const isOpen = openSubject === subject;

            return (
              <div key={subject} className="overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenSubject(isOpen ? null : subject)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl">
                    <SubjectIcon subject={subject} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-bold text-foreground ${subjectNameDirectionClass(subject)}`}>
                      {displaySubject}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedInSubject}/{incomplete.length} selected
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 py-3">
                        {incomplete.length === 0 ? (
                          <p className="py-3 text-center text-sm text-muted-foreground">
                            All chapters complete.
                          </p>
                        ) : (
                          <>
                            <div className="mb-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => onSetSubjectSelection(subject, true)}
                                className="min-h-[44px] flex-1 rounded-2xl border border-primary/30 bg-primary/8 px-3 text-xs font-bold text-primary"
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => onSetSubjectSelection(subject, false)}
                                className="min-h-[44px] flex-1 rounded-2xl border border-border bg-background px-3 text-xs font-bold text-muted-foreground"
                              >
                                Deselect All
                              </button>
                            </div>
                            <div className="space-y-1">
                              {incomplete.map((chapter) => {
                                const selected = getChapterState(
                                  chapterCompletion[subject]?.[chapter],
                                ).selectedForSchedule;
                                const displayChapter = chapterDisplayName(subject, chapter);
                                return (
                                  <button
                                    key={chapter}
                                    type="button"
                                    onClick={() => onToggleChapter(subject, chapter)}
                                    className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-secondary/60"
                                    aria-pressed={selected}
                                  >
                                    <span
                                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 ${
                                        selected
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'border-border bg-background text-transparent'
                                      }`}
                                    >
                                      <CalendarCheck size={16} />
                                    </span>
                                    <span className={`min-w-0 flex-1 text-sm font-medium text-foreground ${subjectDirectionClass(subject)}`}>
                                      {displayChapter}
                                    </span>
                                  </button>
                                );
              })}
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border bg-card px-5 py-4">
          <p className="mb-3 text-center text-xs font-semibold text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} chapter${selectedCount !== 1 ? 's' : ''} selected across ${selectedSubjectCount} subject${selectedSubjectCount !== 1 ? 's' : ''}`
              : 'Select at least one chapter to generate a plan'}
          </p>
          <button
            type="button"
            onClick={onGenerate}
            disabled={selectedCount === 0 || isGenerating}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />
            {isGenerating ? 'Generating...' : 'Generate Plan from Selection'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardContent({ profile }: { profile: Profile }) {
  const {
    currentMode, overallProgress, earnedBadges,
    chapterCompletion, toggleChapter, aiSchedule, setAiSchedule,
    toggleChapterScheduleSelection, setSubjectScheduleSelection,
    markScheduleSelectionConfigured, scheduleSelectionConfigured,
    selectedScheduleChapterCount,
    reminderSettings, practiceHistory, streak,
  } = useAppContext();
  const [, setLocation] = useLocation();

  // AI schedule state
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [showWeekly, setShowWeekly] = useState(false);
  const [showChapterSelection, setShowChapterSelection] = useState(false);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // ── Dates ────────────────────────────────────────────────────────────────
  const greeting = getTimeGreeting();
  const examDate = examDateToLocalDate(profile.examDate);
  const daysLeft = daysUntilDateOnly(profile.examDate);
  const examPassed = daysLeft < 0;
  const examToday = daysLeft === 0;
  const todayStr = todayDateOnly();

  // ── Chapter totals ────────────────────────────────────────────────────────
  const { totalChapters, doneChapters } = useMemo(() => {
    let total = 0, done = 0;
    for (const subj of profile.subjects) {
      const chs = SYLLABUS_DATA[subj] ?? [];
      total += chs.length;
      done += chs.filter((ch) => getChapterState(chapterCompletion[subj]?.[ch]).done).length;
    }
    return { totalChapters: total, doneChapters: done };
  }, [profile.subjects, chapterCompletion]);

  const allDone = totalChapters > 0 && doneChapters === totalChapters;

  // ── Pace ─────────────────────────────────────────────────────────────────
  const prepPeriod = 180;
  const daysElapsed = Math.max(0, prepPeriod - Math.max(0, daysLeft));
  const expectedProgress = (daysElapsed / prepPeriod) * 100;
  const isBehind = overallProgress < expectedProgress - 5;
  const isVeryBehind = overallProgress < expectedProgress - 20;

  // ── Today's tasks — AI first, fallback ───────────────────────────────────
  const todaysTasks = useMemo((): DayTask[] => {
    if (aiSchedule) {
      const dayEntry = aiSchedule.week.find((d) => d.date === todayStr);
      if (dayEntry && dayEntry.blocks.length > 0) {
        // Only include blocks whose chapters still exist in syllabus
        const valid = dayEntry.blocks.filter(
          (b) => SYLLABUS_DATA[b.subject]?.includes(b.chapter),
        );
        if (valid.length > 0) return valid;
      }
    }
    return generateFallbackTasks(profile.subjects, chapterCompletion, daysLeft);
  }, [aiSchedule, todayStr, profile.subjects, chapterCompletion, daysLeft]);

  const allTasksDone = todaysTasks.length > 0 && todaysTasks.every(
    (t) => getChapterState(chapterCompletion[t.subject]?.[t.chapter]).done,
  );

  const nextReminderTask = todaysTasks.find(
    (task) => !getChapterState(chapterCompletion[task.subject]?.[task.chapter]).done,
  ) ?? todaysTasks[0];

  const weakChapter = useMemo(() => {
    // Weak-chapter rule for demo/usefulness: remind the student about the latest chapter whose last recorded
    // practice/quiz/revision score was below 60%, because that is a clear exam-readiness signal.
    const latestByChapter = new Map<string, typeof practiceHistory[number]>();
    for (const attempt of practiceHistory) {
      const key = `${attempt.subject}::${attempt.chapter}`;
      if (!latestByChapter.has(key)) latestByChapter.set(key, attempt);
    }
    return [...latestByChapter.values()].find(
      (attempt) => attempt.total > 0 && attempt.score / attempt.total < 0.6,
    );
  }, [practiceHistory]);

  const reminderText = nextReminderTask
    ? `${subjectDisplayName(nextReminderTask.subject)}: ${chapterDisplayName(nextReminderTask.subject, nextReminderTask.chapter)} at ${reminderSettings.time}`
    : weakChapter
    ? `Revise ${subjectDisplayName(weakChapter.subject)}: ${chapterDisplayName(weakChapter.subject, weakChapter.chapter)} at ${reminderSettings.time}`
    : `Open your study planner at ${reminderSettings.time}`;

  // ── Regenerate handler ────────────────────────────────────────────────────
  const generatePlanFromSelection = async () => {
    if (selectedScheduleChapterCount === 0) {
      setScheduleError('Select at least one chapter to generate a plan.');
      setShowChapterSelection(true);
      return;
    }

    setIsLoadingSchedule(true);
    setScheduleError(null);
    try {
      const subjects = profile.subjects.map((name) => {
        const chapters = SYLLABUS_DATA[name] ?? [];
        const selectedChapters = chapters.filter((ch) => {
          const state = getChapterState(chapterCompletion[name]?.[ch]);
          return !state.done && state.selectedForSchedule;
        });
        return {
          name,
          totalChapters: chapters.length,
          completedChapters: chapters.filter((ch) => getChapterState(chapterCompletion[name]?.[ch]).done).length,
          chapterList: selectedChapters.map((ch) => ({
            name: ch,
            done: false,
            selectedForSchedule: true,
          })),
        };
      }).filter((subject) => subject.chapterList.length > 0);

      const res = await fetch(apiUrl('/api/generate-schedule'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjects,
          daysLeft,
          currentMode,
          studyHoursPerDay: 3,
          startDate: todayStr,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Unknown error');

      setAiSchedule({ ...data.schedule, generatedAt: new Date().toISOString() });
      setShowWeekly(true);
      setShowChapterSelection(false);
      markScheduleSelectionConfigured();
    } catch (err) {
      setScheduleError("Couldn't reach AI planner right now. Using your fallback schedule.");
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const handleRegenerate = async () => {
    if (!scheduleSelectionConfigured) {
      setShowChapterSelection(true);
      return;
    }
    await generatePlanFromSelection();
  };

  // ── Misc ─────────────────────────────────────────────────────────────────
  const recentBadge = earnedBadges.length > 0
    ? MILESTONES.find((m) => m.id === earnedBadges[earnedBadges.length - 1]) ?? null
    : null;
  const unlockedMilestones = MILESTONES.filter((m) => earnedBadges.includes(m.id));

  const isFun = currentMode === 'fun';
  const isBalanced = currentMode === 'balanced';
  const isFocus = currentMode === 'focus';
  const ctr = isFocus ? focusContainer : containerVariants;
  const crd = isFocus ? focusCard : cardVariants;
  const quote = getDailyQuote();

  const subjectProgress = profile.subjects.map((subject) => {
    const chapters = SYLLABUS_DATA[subject] ?? [];
    const done = chapters.filter((ch) => getChapterState(chapterCompletion[subject]?.[ch]).done).length;
    const pct = chapters.length === 0 ? 0 : Math.round((done / chapters.length) * 100);
    return { subject, done, total: chapters.length, pct };
  });

  // ── Schedule meta ─────────────────────────────────────────────────────────
  const weeklyReportLines = [
    `Board: ${profile.board}`,
    `Exam date: ${format(examDate, 'dd MMMM yyyy')} (${Math.max(0, daysLeft)} days left)`,
    `Progress: ${doneChapters}/${totalChapters} chapters (${overallProgress}%)`,
    `Streak: ${streak} day${streak !== 1 ? 's' : ''}`,
    `Badges: ${unlockedMilestones.length ? unlockedMilestones.map((m) => m.title).join(', ') : 'No badges yet'}`,
    'Subject progress:',
    ...subjectProgress.map((item) => `- ${subjectDisplayName(item.subject)}: ${item.done}/${item.total} (${item.pct}%)`),
    'Weekly plan:',
    ...((aiSchedule?.week ?? [{ day: 'Today', date: todayStr, blocks: todaysTasks }])
      .flatMap((day) =>
        day.blocks.slice(0, 3).map((block) =>
          `- ${day.day}: ${subjectDisplayName(block.subject)} - ${chapterDisplayName(block.subject, block.chapter)} (${block.durationMinutes ?? 30} min)`,
        ),
      )
      .slice(0, 10)),
  ];

  function renderWeeklyPlanCanvas(): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#F7F7FB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#5B4BE7';
    ctx.fillRect(0, 0, canvas.width, 190);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 52px Arial';
    ctx.fillText('Matric Study Planner', 70, 90);
    ctx.font = '28px Arial';
    ctx.fillText('Weekly study report', 70, 135);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 34px Arial';
    ctx.fillText(`${profile!.board} - ${format(examDate, 'dd MMM yyyy')}`, 70, 245);
    ctx.font = '24px Arial';
    ctx.fillStyle = '#4B5563';
    ctx.fillText(`${doneChapters}/${totalChapters} chapters complete - ${streak} day streak`, 70, 285);
    let y = 355;
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#111827';
    ctx.fillText('Highlights', 70, y);
    y += 45;
    ctx.font = '24px Arial';
    for (const line of weeklyReportLines.slice(2, 7)) {
      ctx.fillStyle = '#374151';
      ctx.fillText(line.slice(0, 82), 90, y);
      y += 38;
    }
    y += 20;
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#111827';
    ctx.fillText('This Week', 70, y);
    y += 45;
    ctx.font = '23px Arial';
    for (const line of weeklyReportLines.slice(-10)) {
      ctx.fillStyle = '#374151';
      ctx.fillText(line.slice(0, 88), 90, y);
      y += 38;
      if (y > 1260) break;
    }
    return canvas;
  }

  function exportWeeklyPlanPng() {
    const canvas = renderWeeklyPlanCanvas();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `matric-weekly-plan-${todayStr}.png`);
    }, 'image/png');
  }

  async function exportWeeklyPlanPdf() {
    const canvas = renderWeeklyPlanCanvas();
    if (!canvas) return;
    downloadBlob(await buildCanvasPdf(canvas), `matric-weekly-plan-${todayStr}.pdf`);
  }

  const scheduleAge = aiSchedule
    ? Math.round((Date.now() - new Date(aiSchedule.generatedAt).getTime()) / 3600000)
    : null;
  const isScheduleStale = scheduleAge !== null && scheduleAge > 24;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <ModeBanner />

      <motion.div
        className="page-content space-y-5"
        variants={ctr}
        initial="hidden"
        animate="visible"
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div variants={crd}>
          <p className="eyebrow mb-2"><Sparkles size={12} /> Your study command center</p>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h1 className="font-display text-[1.8rem] font-extrabold leading-tight text-foreground">{greeting}, Scholar!</h1>
            <div className="flex items-center gap-2">
              {(isFun || isBalanced) && <StreakCounter compact />}
              <ModeIndicator />
            </div>
          </div>
          {isFun && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="text-sm text-muted-foreground italic leading-snug mt-1"
            >
              "{quote}"
            </motion.p>
          )}
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {doneChapters} of {totalChapters} chapters completed · {selectedScheduleChapterCount} selected for your next plan
          </p>
        </motion.div>

        {/* ── Mascot ──────────────────────────────────────────────────────── */}
        {isFun && (
          <motion.div variants={crd}>
            <Mascot onTrack={!isBehind} veryBehind={isVeryBehind} />
          </motion.div>
        )}

        {/* ── Exam passed ─────────────────────────────────────────────────── */}
        <motion.div variants={crd}>
          <Card className="p-4 space-y-3" noTap>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bell size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Next reminder</p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {reminderSettings.enabled ? reminderText : 'Turn on reminders in Profile'}
                </p>
                {weakChapter && reminderSettings.enabled && (
                  <p className="mt-1 text-xs text-amber-700">
                    Weak chapter flagged from your last low practice score.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {examPassed ? (
          <motion.div variants={crd}>
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg text-center">
              <div className="text-4xl mb-2">🎓</div>
              <h2 className="text-2xl font-black mb-1">Exams Complete!</h2>
              <p className="text-white/80 text-sm">You've made it. Well done!</p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* ── Countdown card ──────────────────────────────────────────── */}
            <motion.div variants={crd}>
              <div className={`relative overflow-hidden rounded-[2rem] p-6 text-white ${
                isFocus ? 'bg-gray-900 shadow-[0_24px_52px_rgba(17,24,39,0.26)]' : 'premium-hero'
              }`}>
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <div className="relative z-10">
                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-white/15 border-white/25 text-white">
                      <span>{isFocus ? '🎯' : isFun ? '🎉' : '⚡'}</span>
                      <span>{isFocus ? 'Focus Mode' : isFun ? 'Fun Mode' : 'Balanced Mode'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      {examToday ? (
                        <div className="text-3xl font-black mb-1">Today is exam day! 💪</div>
                      ) : (
                        <>
                          <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 }}
                            className="font-display mb-1 text-6xl font-extrabold leading-none tracking-[-0.06em]"
                          >
                            {daysLeft}
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                            className="text-white/90 font-medium text-sm mb-3"
                          >
                            Days Until Exam
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                            className="text-white/70 text-xs font-medium bg-black/20 inline-block px-2.5 py-1 rounded-md"
                          >
                            {format(examDate, 'dd MMMM yyyy')}
                          </motion.div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <ProgressRing
                        percentage={overallProgress} size={88} strokeWidth={6}
                        color="#ffffff" bgColor="rgba(255,255,255,0.2)" className="drop-shadow-sm"
                      />
                      <span className="text-white/70 text-[10px] font-medium text-center leading-tight">
                        {doneChapters}/{totalChapters} chapters
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {allDone ? (
              <motion.div variants={crd}>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-6 text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <h2 className="text-xl font-black text-emerald-800 mb-1">You're Fully Prepared!</h2>
                  <p className="text-emerald-700 text-sm">Every chapter done. Revise and stay confident.</p>
                </div>
              </motion.div>
            ) : (
              <>
                {/* ── Streak + Recent Achievement ──────────────────────────── */}
                {(isFun || isBalanced) && (
                  <motion.div variants={crd} className="space-y-3">
                    <StreakCounter />
                    {recentBadge && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 26, delay: 0.2 }}
                        className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3.5"
                      >
                        <span className="text-2xl">{recentBadge.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Recent Achievement</p>
                          <p className="text-sm font-bold text-amber-900">{recentBadge.title}</p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── Today's Tasks ────────────────────────────────────────── */}
                <motion.div variants={crd} className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground tracking-tight">Today's Tasks</h2>
                      {aiSchedule && !isScheduleStale && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          <Sparkles size={9} />
                          AI
                        </span>
                      )}
                      {isScheduleStale && (
                        <span className="text-[10px] text-amber-600 font-medium">plan is 24h+ old</span>
                      )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarCheck size={12} className="text-primary" />
                          Plan based on {selectedScheduleChapterCount} selected chapter{selectedScheduleChapterCount !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowChapterSelection(true)}
                          className="inline-flex min-h-[44px] items-center font-semibold text-primary underline-offset-2 hover:underline"
                        >
                          Edit selection
                        </button>
                      </div>
                    </div>
                    <motion.button
                      onClick={handleRegenerate}
                      disabled={isLoadingSchedule}
                      whileTap={{ scale: 0.92 }}
                      className={`flex min-h-[44px] items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-2xl border transition-colors ${
                        isFocus
                          ? 'border-border text-foreground bg-secondary hover:bg-secondary/80'
                          : 'border-primary/30 text-primary bg-primary/8 hover:bg-primary/15'
                      } disabled:opacity-50`}
                    >
                      <motion.span
                        animate={isLoadingSchedule ? { rotate: 360 } : { rotate: 0 }}
                        transition={isLoadingSchedule ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
                      >
                        <RefreshCw size={11} />
                      </motion.span>
                      {isLoadingSchedule ? 'Generating…' : aiSchedule ? 'Regenerate Plan' : 'Generate Plan'}
                    </motion.button>
                  </div>

                  {/* Error banner */}
                  <AnimatePresence>
                    {scheduleError && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3"
                      >
                        <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-snug">{scheduleError}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Skeleton while loading */}
                  {isLoadingSchedule ? (
                    <Card className="p-4 space-y-3" noTap>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-lg bg-muted animate-pulse" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-muted animate-pulse rounded-full" style={{ width: `${60 + i * 10}%` }} />
                            <div className="h-2.5 bg-muted animate-pulse rounded-full w-1/3" />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-center text-muted-foreground pt-1">
                        Building your exam plan. This usually takes a few seconds...
                      </p>
                    </Card>
                  ) : todaysTasks.length === 0 ? (
                    <Card className="flex flex-col items-center text-center p-8 border-dashed border-2 bg-transparent" noTap>
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                        <BookCheck className="text-primary" size={24} />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">Build today's plan</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        Select the chapters you want to study and generate a focused schedule.
                      </p>
                      <Button
                        type="button"
                        onClick={() => setShowChapterSelection(true)}
                        className="min-h-[44px] rounded-2xl px-5"
                      >
                        Select Chapters
                      </Button>
                    </Card>
                  ) : allTasksDone ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 26 }}
                      className={`rounded-2xl p-6 text-center ${
                        isFocus ? 'bg-gray-50 border border-gray-200' : 'bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200'
                      }`}
                    >
                      <div className="text-3xl mb-2">{isFocus ? '✓' : '🎉'}</div>
                      <h3 className={`font-bold mb-1 ${isFocus ? 'text-foreground' : 'text-emerald-800'}`}>
                        {isFocus ? 'All tasks complete.' : 'All done for today!'}
                      </h3>
                      <p className={`text-sm ${isFocus ? 'text-muted-foreground' : 'text-emerald-700'}`}>
                        {isFocus ? 'Return tomorrow for your next set.' : 'Great work! Check off more in the Syllabus tab.'}
                      </p>
                    </motion.div>
                  ) : (
                    <Card className="divide-y divide-border p-0 overflow-hidden" noTap>
                      {todaysTasks.map(({ subject, chapter, durationMinutes }, idx) => {
                        const checked = getChapterState(chapterCompletion[subject]?.[chapter]).done;
                        const displaySubject = subjectDisplayName(subject);
                        const displayChapter = chapterDisplayName(subject, chapter);
                        return (
                          <motion.div
                            key={`${subject}__${chapter}`}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300, damping: 28 }}
                            className="flex items-center gap-3 px-4 py-3.5"
                          >
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-xl text-primary">
                              <SubjectIcon subject={subject} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium leading-snug transition-colors duration-200 ${subjectDirectionClass(subject)} ${
                                checked ? 'line-through text-muted-foreground' : 'text-foreground'
                              }`}>
                                {displayChapter}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <span className={subjectNameDirectionClass(subject)}>{displaySubject}</span>
                                {durationMinutes && (
                                  <span className="flex items-center gap-0.5">
                                    <Clock size={10} />
                                    {durationMinutes}m
                                  </span>
                                )}
                              </p>
                            </div>
                            <TaskCheckbox compact checked={checked} subject={subject} onToggle={() => toggleChapter(subject, chapter)} />
                          </motion.div>
                        );
                      })}
                    </Card>
                  )}
                </motion.div>

                {/* ── Weekly Plan ──────────────────────────────────────────── */}
                {aiSchedule && (
                  <motion.div variants={crd} className="space-y-3">
                    <button
                      className="flex items-center gap-2 w-full text-left"
                      onClick={() => setShowWeekly((v) => !v)}
                    >
                      <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                        <Calendar size={18} className="text-primary" />
                        7-Day AI Plan
                      </h2>
                      <span className="text-xs text-muted-foreground flex-1">
                        Generated {scheduleAge === 0 ? 'just now' : `${scheduleAge}h ago`}
                      </span>
                      <motion.div
                        animate={{ rotate: showWeekly ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      >
                        <ChevronDown size={18} className="text-muted-foreground" />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {showWeekly && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <WeeklyView
                            days={aiSchedule.week}
                            chapterCompletion={chapterCompletion}
                            toggleChapter={toggleChapter}
                            isFocus={isFocus}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* ── Subject Quick-Glance Row ─────────────────────────────── */}
                <motion.div variants={crd}>
                  <Card className="p-4 space-y-3" noTap>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Download size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-foreground">Share Weekly Plan</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Export progress and this week's tasks for parents or teachers.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={exportWeeklyPlanPng} className="px-3">
                        <Download className="mr-2 h-4 w-4" />
                        PNG
                      </Button>
                      <Button variant="outline" onClick={exportWeeklyPlanPdf} className="px-3">
                        <FileText className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </Card>
                </motion.div>

                <motion.div variants={crd} className="space-y-3">
                  <h2 className="text-lg font-bold text-foreground tracking-tight">Your Subjects</h2>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5" style={{ scrollbarWidth: 'none' }}>
                    {subjectProgress.map(({ subject, done, total, pct }, i) => (
                      <motion.button
                        key={subject}
                        initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.04, type: 'spring', stiffness: 380, damping: 26 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setLocation('/syllabus')}
                        className="flex-shrink-0 w-32 bg-card border border-border rounded-2xl p-3 text-left shadow-sm"
                      >
                        <div className="mb-1.5 flex h-6 items-center text-xl">
                          <SubjectIcon subject={subject} className="h-5 w-5" />
                        </div>
                        <p className={`text-xs font-semibold text-foreground leading-snug truncate mb-1.5 ${subjectNameDirectionClass(subject)}`}>
                          {subjectDisplayName(subject)}
                        </p>
                        <ProgressBar percentage={pct} height="h-1.5" />
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{done}/{total} · {pct}%</p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* ── Mini Calendar ────────────────────────────────────────── */}
                <motion.div variants={crd}><MiniCalendar /></motion.div>

                {/* ── Badges ───────────────────────────────────────────────── */}
                {isFun && unlockedMilestones.length > 0 && (
                  <motion.div variants={crd} className="space-y-3">
                    <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                      <Award size={18} className="text-amber-500" />
                      Badges Earned
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {unlockedMilestones.map((m) => (
                        <motion.div
                          key={m.id}
                          initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="flex flex-col items-center gap-1 bg-card border border-border rounded-2xl p-3 w-20 text-center"
                        >
                          <span className="text-2xl">{m.icon}</span>
                          <span className="text-[10px] font-semibold text-foreground leading-tight">{m.title}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── Progress nudge ───────────────────────────────────────── */}
                {!allDone && overallProgress > 0 && (
                  <motion.div variants={crd}>
                    <div className={`flex items-center gap-3 rounded-2xl p-4 ${
                      isFocus ? 'bg-secondary border border-border' : 'bg-primary/5 border border-primary/15'
                    }`}>
                      <PartyPopper size={20} className={isFocus ? 'text-muted-foreground' : 'text-primary'} />
                      <p className="text-sm text-foreground font-medium">
                        {overallProgress}% complete — {totalChapters - doneChapters} chapter
                        {totalChapters - doneChapters !== 1 ? 's' : ''} to go!
                      </p>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </>
        )}
      </motion.div>
      <AnimatePresence>
        {showChapterSelection && (
          <ChapterSelectionModal
            subjects={profile.subjects}
            chapterCompletion={chapterCompletion}
            selectedCount={selectedScheduleChapterCount}
            onClose={() => setShowChapterSelection(false)}
            onGenerate={generatePlanFromSelection}
            onToggleChapter={toggleChapterScheduleSelection}
            onSetSubjectSelection={setSubjectScheduleSelection}
            isGenerating={isLoadingSchedule}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAppContext();
  return profile ? <DashboardContent profile={profile} /> : null;
}
