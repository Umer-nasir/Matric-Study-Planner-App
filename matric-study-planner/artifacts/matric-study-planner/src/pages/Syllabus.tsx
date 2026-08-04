import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { AlertCircle, CalendarCheck, ChevronDown } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { SYLLABUS_DATA } from '@/data/syllabusData';
import { ProgressBar } from '@/components/ProgressBar';
import { SubjectIcon } from '@/components/SubjectIcon';
import type { ChapterState } from '@/context/AppContext';
import {
  chapterDisplayName,
  subjectDirectionClass,
  subjectDisplayName,
  subjectNameDirectionClass,
} from '@/lib/subjectLanguage';

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
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        checked
          ? 'border-primary bg-primary text-primary-foreground shadow-primary/20'
          : 'border-slate-200 bg-slate-50 text-transparent hover:border-primary/30 hover:bg-primary/5'
      }`}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.04 }}
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
  needsPractice: Set<string>;
}

function SubjectCard({ subject, chapters, completion, onToggle, needsPractice }: SubjectCardProps) {
  const [open, setOpen] = useState(false);
  const displaySubject = subjectDisplayName(subject);

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
            <span className={`font-semibold text-foreground truncate ${subjectNameDirectionClass(subject)}`}>
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
                const displayChapter = chapterDisplayName(subject, chapter);
                return (
                  <div
                    key={chapter}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <Checkbox
                      checked={isChecked}
                      onToggle={() => onToggle(chapter)}
                    />
                    <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 px-2 py-1">
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-sm font-semibold leading-snug transition-colors duration-200 ${subjectDirectionClass(subject)} ${
                            isChecked
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground'
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
                    </div>
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

  return (
    <div className="app-shell pb-24">
      <motion.div
        className="space-y-5 px-5 pb-6 pt-8 sm:px-7"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={cardVariants}>
          <p className="eyebrow mb-2">Curriculum progress</p>
          <h1 className="font-display text-[1.8rem] font-extrabold text-foreground">Syllabus Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Check off chapters as you revise them.
          </p>
        </motion.div>

        {/* Overall progress card */}
        <motion.div
          variants={cardVariants}
          className="glass-surface rounded-[1.4rem] p-5"
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
              needsPractice={lowScoreChapters[subject] ?? new Set()}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
