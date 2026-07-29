import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  Bookmark,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardCheck,
  FileQuestion,
  FileText,
  Layers,
  ListChecks,
  Loader2,
  Pencil,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ModeIndicator } from '@/components/ModeIndicator';
import { SubjectIcon } from '@/components/SubjectIcon';
import { useAppContext } from '@/context/AppContext';
import type { PracticeAttempt } from '@/context/AppContext';
import { SYLLABUS_DATA } from '@/data/syllabusData';
import { apiUrl } from '@/lib/api';
import { getSubjectStudyLanguage } from '@/lib/subjectLanguage';
import { rtlTextClass } from '@/lib/textDirection';

type QuestionType = 'mcq' | 'short' | 'long' | 'definition';
type PracticeMode = 'chapter' | 'quiz' | 'revision';
type PracticeAttemptType = 'chapter' | 'quiz' | 'revision';
type ChapterTarget = { subject: string; chapter: string; reason?: string };

type PracticeSet = {
  mcqs?: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  shortQuestions?: Array<{ question: string; modelAnswer: string }>;
  longQuestions?: Array<{ question: string; modelAnswer: string }>;
  definitions?: Array<{ term: string; definition: string }>;
};

type DefinitionCheckResult = {
  correct: boolean;
  feedback: string;
  modelAnswer: string;
};

const TYPE_OPTIONS: Array<{ value: QuestionType; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { value: 'mcq', label: 'MCQs', icon: ClipboardCheck },
  { value: 'short', label: 'Short Questions', icon: Pencil },
  { value: 'long', label: 'Long Questions', icon: FileText },
  { value: 'definition', label: 'Definitions', icon: Bookmark },
];

const PRACTICE_MODES: Array<{ value: PracticeMode; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { value: 'chapter', label: 'By Chapter', icon: FileQuestion },
  { value: 'quiz', label: 'Quiz', icon: Clock },
  { value: 'revision', label: 'Revision', icon: Brain },
];

const HISTORY_TYPE_STYLES: Record<PracticeAttemptType, string> = {
  chapter: 'bg-secondary text-muted-foreground',
  quiz: 'bg-violet-50 text-violet-700',
  revision: 'bg-amber-50 text-amber-700',
};

function normalizePracticeSet(data: unknown): PracticeSet {
  const candidate = data && typeof data === 'object' ? (data as PracticeSet) : {};
  return {
    mcqs: Array.isArray(candidate.mcqs) ? candidate.mcqs : [],
    shortQuestions: Array.isArray(candidate.shortQuestions) ? candidate.shortQuestions : [],
    longQuestions: Array.isArray(candidate.longQuestions) ? candidate.longQuestions : [],
    definitions: Array.isArray(candidate.definitions) ? candidate.definitions : [],
  };
}

function optionText(option: string): string {
  const trimmed = option.trim();
  return /^[A-D][).:\s-]/i.test(trimmed) ? trimmed.replace(/^[A-D][).:\s-]\s*/i, '') : trimmed;
}

function definitionKey(subject: string, chapter: string, term: string): string {
  return `${subject}::${chapter}::${term}`.toLowerCase();
}

function loadDefinitionChecks(): Record<string, DefinitionCheckResult> {
  try {
    const raw = localStorage.getItem('matric_definition_checks');
    return raw ? (JSON.parse(raw) as Record<string, DefinitionCheckResult>) : {};
  } catch {
    return {};
  }
}

function scoreTone(score: number, total: number): string {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 0.8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (pct >= 0.5) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function scorePercent(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function targetKey(target: ChapterTarget): string {
  return `${target.subject}::${target.chapter}`;
}

function attemptType(attempt: PracticeAttempt): PracticeAttemptType {
  return attempt.type ?? 'chapter';
}

export default function Practice() {
  const { profile, currentMode, chapterCompletion, practiceHistory, addPracticeAttempt } = useAppContext();
  const isFocus = currentMode === 'focus';
  const defaultTypes: QuestionType[] = isFocus
    ? ['mcq', 'short']
    : ['mcq', 'short', 'long', 'definition'];

  const subjectOptions = profile?.subjects ?? [];
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(isFocus ? 'revision' : 'chapter');
  const [subject, setSubject] = useState(subjectOptions[0] ?? '');
  const chapterOptions = useMemo(() => SYLLABUS_DATA[subject] ?? [], [subject]);
  const [chapter, setChapter] = useState(chapterOptions[0] ?? '');
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'week' | 'subject'>('all');
  const [selectedAttempt, setSelectedAttempt] = useState<PracticeAttempt | null>(null);
  const [handledChapterPrefill, setHandledChapterPrefill] = useState(false);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(defaultTypes);
  const [countPerType] = useState(3);
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcqIndex, setMcqIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [definitionIndex, setDefinitionIndex] = useState(0);
  const [definitionAnswers, setDefinitionAnswers] = useState<Record<string, string>>({});
  const [definitionChecks, setDefinitionChecks] = useState<Record<string, DefinitionCheckResult>>(() =>
    loadDefinitionChecks(),
  );
  const [checkingDefinitionKey, setCheckingDefinitionKey] = useState<string | null>(null);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [recordedMcqSetKey, setRecordedMcqSetKey] = useState<string | null>(null);
  const [activeSessionType, setActiveSessionType] = useState<PracticeAttemptType>('chapter');
  const [activeRevisionReasons, setActiveRevisionReasons] = useState<string[]>([]);
  const [activeTargets, setActiveTargets] = useState<ChapterTarget[]>([]);
  const [activeAttemptSubject, setActiveAttemptSubject] = useState('');
  const [activeAttemptChapter, setActiveAttemptChapter] = useState('');
  const [quizSubject, setQuizSubject] = useState('All Subjects');
  const [quizSelectedKeys, setQuizSelectedKeys] = useState<string[]>([]);
  const [quizLength, setQuizLength] = useState<5 | 10 | 15>(5);
  const [quizSet, setQuizSet] = useState<PracticeSet | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSecondsLeft, setQuizSecondsLeft] = useState(60);
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);
  const [quizComplete, setQuizComplete] = useState(false);
  const [recordedQuizKey, setRecordedQuizKey] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectOptions.includes(subject)) {
      setSubject(subjectOptions[0] ?? '');
    }
  }, [subject, subjectOptions]);

  useEffect(() => {
    if (handledChapterPrefill || subjectOptions.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const prefillSubject = params.get('subject') ?? '';
    const prefillChapter = params.get('chapter') ?? '';
    if (!prefillSubject || !prefillChapter) {
      setHandledChapterPrefill(true);
      return;
    }
    if (subjectOptions.includes(prefillSubject) && (SYLLABUS_DATA[prefillSubject] ?? []).includes(prefillChapter)) {
      setPracticeMode('chapter');
      setSubject(prefillSubject);
      setChapter(prefillChapter);
      setChapterPickerOpen(false);
    }
    setHandledChapterPrefill(true);
  }, [handledChapterPrefill, subjectOptions]);

  useEffect(() => {
    const chapters = SYLLABUS_DATA[subject] ?? [];
    if (!chapters.includes(chapter)) {
      setChapter(chapters[0] ?? '');
    }
  }, [chapter, subject]);

  useEffect(() => {
    setQuestionTypes(defaultTypes);
  }, [currentMode]);

  useEffect(() => {
    if (currentMode === 'focus') {
      setPracticeMode('revision');
    }
  }, [currentMode]);

  useEffect(() => {
    setQuizSelectedKeys([]);
  }, [quizSubject]);

  const currentMcqs = practiceSet?.mcqs ?? [];
  const mcqScore = currentMcqs.reduce((score, mcq, index) => {
    return mcqAnswers[index] === mcq.correctIndex ? score + 1 : score;
  }, 0);
  const answeredMcqCount = Object.keys(mcqAnswers).length;
  const mcqComplete = currentMcqs.length > 0 && answeredMcqCount >= currentMcqs.length;
  const weekAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  }, []);
  const sessionsThisWeek = practiceHistory.filter((attempt) => new Date(attempt.date) >= weekAgo).length;
  const sortedHistory = useMemo(() => {
    const filtered =
      historyFilter === 'week'
        ? practiceHistory.filter((attempt) => new Date(attempt.date) >= weekAgo)
        : historyFilter === 'subject'
        ? practiceHistory.filter((attempt) => attempt.subject === subject)
        : practiceHistory;
    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [historyFilter, practiceHistory, subject, weekAgo]);
  const allChapterTargets = useMemo<ChapterTarget[]>(() => {
    return subjectOptions.flatMap((item) =>
      (SYLLABUS_DATA[item] ?? []).map((itemChapter) => ({ subject: item, chapter: itemChapter })),
    );
  }, [subjectOptions]);
  const quizChapterTargets = useMemo<ChapterTarget[]>(() => {
    return quizSubject === 'All Subjects'
      ? allChapterTargets
      : (SYLLABUS_DATA[quizSubject] ?? []).map((itemChapter) => ({
          subject: quizSubject,
          chapter: itemChapter,
        }));
  }, [allChapterTargets, quizSubject]);
  const selectedQuizTargets = useMemo<ChapterTarget[]>(() => {
    if (quizSelectedKeys.length === 0) return quizChapterTargets;
    const selected = new Set(quizSelectedKeys);
    return quizChapterTargets.filter((target) => selected.has(targetKey(target)));
  }, [quizChapterTargets, quizSelectedKeys]);
  const revisionItems = useMemo<ChapterTarget[]>(() => {
    const latestByChapter = new Map<string, PracticeAttempt>();
    for (const attempt of practiceHistory) {
      const key = `${attempt.subject}::${attempt.chapter}`;
      const existing = latestByChapter.get(key);
      if (!existing || new Date(attempt.date) > new Date(existing.date)) {
        latestByChapter.set(key, attempt);
      }
    }

    const flagged = new Map<string, ChapterTarget>();
    latestByChapter.forEach((attempt, key) => {
      const percent = scorePercent(attempt.score, attempt.total);
      if (percent < 60) {
        flagged.set(key, {
          subject: attempt.subject,
          chapter: attempt.chapter,
          reason: `${attempt.subject} - ${attempt.chapter}: scored ${percent}% in recent practice`,
        });
      }
    });

    for (const target of allChapterTargets) {
      const done = chapterCompletion[target.subject]?.[target.chapter]?.done;
      if (!done) continue;
      const key = targetKey(target);
      if (flagged.has(key) || latestByChapter.has(key)) continue;
      flagged.set(key, {
        ...target,
        reason: `${target.subject} - ${target.chapter}: marked complete, but no practice attempt yet`,
      });
    }

    if (flagged.size === 0) {
      allChapterTargets.slice(0, 4).forEach((target) => {
        flagged.set(targetKey(target), {
          ...target,
          reason: `${target.subject} - ${target.chapter}: starter revision pick from your selected subjects`,
        });
      });
    }

    return [...flagged.values()].slice(0, 6);
  }, [allChapterTargets, chapterCompletion, practiceHistory]);
  const quizMcqs = quizSet?.mcqs ?? [];
  const quizScore = quizMcqs.reduce((score, mcq, index) => {
    return quizAnswers[index] === mcq.correctIndex ? score + 1 : score;
  }, 0);
  const quizDurationSeconds = quizStartedAt ? Math.max(1, Math.round((Date.now() - quizStartedAt) / 1000)) : 0;

  useEffect(() => {
    if (!mcqComplete || currentMcqs.length === 0) return;
    const attemptSubject = activeAttemptSubject || subject;
    const attemptChapter = activeAttemptChapter || chapter;
    const setKey = `${activeSessionType}|${attemptSubject}|${attemptChapter}|${currentMcqs.length}|${currentMcqs.map((mcq) => mcq.question).join('|')}`;
    if (recordedMcqSetKey === setKey) return;
    const pct = Math.round((mcqScore / currentMcqs.length) * 100);
    addPracticeAttempt({
      type: activeSessionType,
      subject: attemptSubject,
      chapter: attemptChapter,
      score: mcqScore,
      total: currentMcqs.length,
      totalQuestions: currentMcqs.length,
      revisionReasons: activeSessionType === 'revision' ? activeRevisionReasons : undefined,
      chapters: activeTargets.length ? activeTargets.map(({ subject: itemSubject, chapter: itemChapter }) => ({
        subject: itemSubject,
        chapter: itemChapter,
      })) : undefined,
      questionsAndAnswers: currentMcqs.map((mcq, index) => {
        const selectedIndex = mcqAnswers[index] ?? -1;
        return {
          question: mcq.question,
          options: mcq.options.slice(0, 4),
          selectedIndex,
          correctIndex: mcq.correctIndex,
          explanation: mcq.explanation,
          wasCorrect: selectedIndex === mcq.correctIndex,
        };
      }),
    });
    setRecordedMcqSetKey(setKey);
    if (!isFocus && pct >= 80) {
      setCelebrate(true);
      window.setTimeout(() => setCelebrate(false), 1600);
    }
  }, [
    activeRevisionReasons,
    activeSessionType,
    activeTargets,
    activeAttemptChapter,
    activeAttemptSubject,
    addPracticeAttempt,
    chapter,
    currentMcqs,
    isFocus,
    mcqComplete,
    mcqScore,
    recordedMcqSetKey,
    subject,
  ]);

  useEffect(() => {
    if (practiceMode !== 'quiz' || quizComplete || quizMcqs.length === 0) return;
    if (quizAnswers[quizIndex] !== undefined) return;
    const timer = window.setInterval(() => {
      setQuizSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [practiceMode, quizAnswers, quizComplete, quizIndex, quizMcqs.length]);

  useEffect(() => {
    if (practiceMode !== 'quiz' || quizComplete || quizMcqs.length === 0) return;
    if (quizSecondsLeft > 0 || quizAnswers[quizIndex] !== undefined) return;
    advanceQuiz(-1);
  }, [practiceMode, quizAnswers, quizComplete, quizIndex, quizMcqs.length, quizSecondsLeft]);

  useEffect(() => {
    if (!quizComplete || quizMcqs.length === 0) return;
    const setKey = `quiz|${quizStartedAt}|${quizMcqs.map((mcq) => mcq.question).join('|')}`;
    if (recordedQuizKey === setKey) return;
    addPracticeAttempt({
      type: 'quiz',
      subject: quizSubject,
      chapter: quizSubject === 'All Subjects' ? 'Mixed quiz' : `${selectedQuizTargets.length} selected chapters`,
      score: quizScore,
      total: quizMcqs.length,
      totalQuestions: quizMcqs.length,
      durationSeconds: quizDurationSeconds,
      chapters: selectedQuizTargets.map(({ subject: itemSubject, chapter: itemChapter }) => ({
        subject: itemSubject,
        chapter: itemChapter,
      })),
      questionsAndAnswers: quizMcqs.map((mcq, index) => {
        const selectedIndex = quizAnswers[index] ?? -1;
        return {
          question: mcq.question,
          options: mcq.options.slice(0, 4),
          selectedIndex,
          correctIndex: mcq.correctIndex,
          explanation: mcq.explanation,
          wasCorrect: selectedIndex === mcq.correctIndex,
        };
      }),
    });
    setRecordedQuizKey(setKey);
  }, [
    addPracticeAttempt,
    quizAnswers,
    quizComplete,
    quizDurationSeconds,
    quizMcqs,
    quizScore,
    quizStartedAt,
    quizSubject,
    recordedQuizKey,
    selectedQuizTargets,
  ]);

  function toggleQuestionType(type: QuestionType) {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  }

  async function generatePracticeSet(overrides?: {
    subject?: string;
    chapter?: string;
    type?: PracticeAttemptType;
    targets?: ChapterTarget[];
    revisionReasons?: string[];
    questionTypes?: QuestionType[];
  }) {
    const targetSubject = overrides?.subject ?? subject;
    const targetChapter = overrides?.chapter ?? chapter;
    const targetQuestionTypes = overrides?.questionTypes ?? questionTypes;
    if (!targetSubject || !targetChapter || targetQuestionTypes.length === 0 || !profile) return;
    if (overrides?.subject) setSubject(overrides.subject);
    if (overrides?.chapter) setChapter(overrides.chapter);
    setActiveSessionType(overrides?.type ?? 'chapter');
    setActiveRevisionReasons(overrides?.revisionReasons ?? []);
    setActiveTargets(overrides?.targets ?? [{ subject: targetSubject, chapter: targetChapter }]);
    setActiveAttemptSubject(overrides?.type === 'revision' ? 'Targeted Revision' : targetSubject);
    setActiveAttemptChapter(overrides?.type === 'revision' ? `${overrides.targets?.length ?? 1} chapters` : targetChapter);
    setIsLoading(true);
    setError(null);
    setPracticeSet(null);
    setMcqIndex(0);
    setMcqAnswers({});
    setRevealedAnswers({});
    setDefinitionIndex(0);
    setRecordedMcqSetKey(null);
    setDefinitionError(null);

    try {
      const res = await fetch(apiUrl('/api/generate-practice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: targetSubject,
          chapter: targetChapter,
          board: profile.board,
          responseLanguage: getSubjectStudyLanguage(targetSubject, profile.subjectLanguages),
          questionTypes: targetQuestionTypes,
          countPerType,
          mode: overrides?.type ?? 'chapter',
          chapters: overrides?.targets,
        }),
      });
      const data = (await res.json()) as { ok: boolean; data?: unknown; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Practice generation failed.');
      }
      setPracticeSet(normalizePracticeSet(data.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.toLowerCase().includes('json') || message.toLowerCase().includes('escaped')
          ? 'The AI made a formatting mistake. Please try again.'
          : message || 'Practice generation failed. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function toggleQuizTarget(target: ChapterTarget) {
    const key = targetKey(target);
    setQuizSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  function advanceQuiz(answerIndex: number) {
    setQuizAnswers((prev) => {
      if (prev[quizIndex] !== undefined) return prev;
      return { ...prev, [quizIndex]: answerIndex };
    });

    if (quizIndex >= quizMcqs.length - 1) {
      setQuizComplete(true);
      return;
    }

    window.setTimeout(() => {
      setQuizIndex((index) => Math.min(index + 1, quizMcqs.length - 1));
      setQuizSecondsLeft(60);
    }, 250);
  }

  async function generateQuizSet() {
    if (!profile || selectedQuizTargets.length === 0) return;
    setQuizLoading(true);
    setQuizError(null);
    setQuizSet(null);
    setQuizIndex(0);
    setQuizAnswers({});
    setQuizSecondsLeft(60);
    setQuizComplete(false);
    setRecordedQuizKey(null);
    setQuizStartedAt(null);

    try {
      const res = await fetch(apiUrl('/api/generate-practice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: quizSubject,
          chapter: quizSubject === 'All Subjects' ? 'Mixed quiz' : 'Selected chapters quiz',
          board: profile.board,
          responseLanguage: quizSubject === 'All Subjects' ? undefined : getSubjectStudyLanguage(quizSubject, profile.subjectLanguages),
          mode: 'quiz',
          chapters: selectedQuizTargets,
          questionTypes: ['mcq'],
          countPerType: quizLength,
          totalQuestions: quizLength,
        }),
      });
      const data = (await res.json()) as { ok: boolean; data?: unknown; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Quiz generation failed.');
      }
      setQuizSet(normalizePracticeSet(data.data));
      setQuizStartedAt(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setQuizError(
        message.toLowerCase().includes('json') || message.toLowerCase().includes('escaped')
          ? 'The AI made a formatting mistake. Please try again.'
          : message || 'Quiz generation failed. Please try again.',
      );
    } finally {
      setQuizLoading(false);
    }
  }

  async function generateRevisionSet() {
    if (revisionItems.length === 0) return;
    const targets = revisionItems.slice(0, 4);
    await generatePracticeSet({
      subject: targets[0].subject,
      chapter: targets.length === 1 ? targets[0].chapter : 'Targeted Revision',
      type: 'revision',
      targets,
      revisionReasons: targets.map((item) => item.reason ?? `${item.subject} - ${item.chapter}`),
      questionTypes: ['mcq', 'short', 'definition'],
    });
  }

  function retryMcqs() {
    setMcqIndex(0);
    setMcqAnswers({});
    setRecordedMcqSetKey(null);
    setCelebrate(false);
  }

  async function checkDefinitionAnswer(definition: { term: string; definition: string }) {
    if (!profile) return;
    const key = definitionKey(subject, chapter, definition.term);
    const studentAnswer = definitionAnswers[key]?.trim() ?? '';
    if (studentAnswer.length < 5) {
      setDefinitionError('Write your definition first, then check it.');
      return;
    }

    setDefinitionError(null);
    setCheckingDefinitionKey(key);
    try {
      const res = await fetch(apiUrl('/api/check-definition'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          chapter,
          board: profile.board,
          responseLanguage: getSubjectStudyLanguage(subject, profile.subjectLanguages),
          term: definition.term,
          expectedDefinition: definition.definition,
          studentAnswer,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        data?: DefinitionCheckResult;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.data) {
        throw new Error(data.error ?? 'Could not check this definition.');
      }
      const result = data.data;
      setDefinitionChecks((prev) => {
        const next = { ...prev, [key]: result };
        localStorage.setItem('matric_definition_checks', JSON.stringify(next));
        return next;
      });
    } catch (err) {
      setDefinitionError(err instanceof Error ? err.message : 'Could not check this definition.');
    } finally {
      setCheckingDefinitionKey(null);
    }
  }

  if (!profile) return null;

  const currentMcq = currentMcqs[mcqIndex];
  const currentAnswer = mcqAnswers[mcqIndex];
  const currentDefinition = practiceSet?.definitions?.[definitionIndex];
  const definitionItems = practiceSet?.definitions ?? [];
  const checkedCount = definitionItems.filter(
    (item) => definitionChecks[definitionKey(subject, chapter, item.term)],
  ).length;
  const correctDefinitionCount = definitionItems.filter(
    (item) => definitionChecks[definitionKey(subject, chapter, item.term)]?.correct,
  ).length;
  const currentDefinitionKey = currentDefinition
    ? definitionKey(subject, chapter, currentDefinition.term)
    : '';
  const currentDefinitionCheck = currentDefinitionKey
    ? definitionChecks[currentDefinitionKey]
    : undefined;

  return (
    <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background pb-28 shadow-[0_0_40px_rgba(0,0,0,0.05)]">
      <div className="px-5 pt-10 pb-6 space-y-5">
        <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">Practice</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Test Yourself</h1>
              <p className="mt-2 text-sm opacity-90">
                {sessionsThisWeek} practice session{sessionsThisWeek !== 1 ? 's' : ''} completed this week
              </p>
            </div>
            <ModeIndicator />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-1">
          {PRACTICE_MODES.map((mode) => {
            const Icon = mode.icon;
            const selected = practiceMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setPracticeMode(mode.value)}
                className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl text-xs font-black transition-colors ${
                  selected ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Icon size={14} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
        {isFocus && practiceMode !== 'revision' && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            Focus Mode suggests Revision first so weak chapters get cleaned up before exams.
          </p>
        )}

        {practiceMode === 'chapter' && (
        <Card className="p-4" noTap>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Choose subject</p>
          <div className="grid grid-cols-2 gap-2">
            {subjectOptions.map((item) => {
              const selected = subject === item;
              return (
                <motion.button
                  key={item}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSubject(item);
                    setChapter(SYLLABUS_DATA[item]?.[0] ?? '');
                  }}
                  className={`min-h-[68px] rounded-2xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground'
                  }`}
                >
                  <SubjectIcon subject={item} className="h-5 w-5 text-xl" />
                  <span className="mt-1 block truncate text-sm font-bold">{item}</span>
                </motion.button>
              );
            })}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setChapterPickerOpen((open) => !open)}
              className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 text-left"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Chapter</p>
                <p className="truncate text-sm font-bold text-foreground">{chapter || 'Select a chapter'}</p>
              </div>
              <motion.div animate={{ rotate: chapterPickerOpen ? 180 : 0 }}>
                <ChevronDown size={18} className="text-muted-foreground" />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {chapterPickerOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-border bg-background"
                >
                  {chapterOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setChapter(item);
                        setChapterPickerOpen(false);
                      }}
                      className={`flex min-h-[44px] w-full items-center justify-between px-4 text-left text-sm font-semibold ${
                        chapter === item ? 'bg-primary/10 text-primary' : 'text-foreground'
                      }`}
                    >
                      <span>{item}</span>
                      {chapter === item && <Check size={15} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Question types
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((type) => {
                const selected = questionTypes.includes(type.value);
                const Icon = type.icon;
                return (
                  <motion.button
                    key={type.value}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    animate={{ scale: selected ? 1.02 : 1 }}
                    onClick={() => toggleQuestionType(type.value)}
                    className={`flex min-h-[52px] items-center gap-2 rounded-2xl border px-3 text-left text-xs font-bold transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{type.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <Button
            className="mt-4 bg-primary shadow-lg"
            fullWidth
            disabled={isLoading || questionTypes.length === 0 || !subject || !chapter}
            onClick={() => generatePracticeSet()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Practice Set'
            )}
          </Button>
          {questionTypes.length === 0 && (
            <p className="mt-2 text-center text-xs font-semibold text-amber-700">
              Select at least one question type.
            </p>
          )}
        </Card>
        )}

        {practiceMode === 'quiz' && (
          <Card className="p-4" noTap>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quiz mode</p>
                <h2 className="text-lg font-black text-foreground">Timed MCQ test</h2>
              </div>
              <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right text-primary">
                <p className="text-lg font-black">{quizLength}</p>
                <p className="text-[10px] font-bold uppercase">questions</p>
              </div>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Subject</p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {['All Subjects', ...subjectOptions].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuizSubject(item)}
                  className={`min-h-[44px] rounded-2xl border px-3 text-sm font-bold ${
                    quizSubject === item
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Chapters {quizSelectedKeys.length === 0 ? '(all selected)' : `(${selectedQuizTargets.length} selected)`}
            </p>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-border bg-background p-2">
              {quizChapterTargets.map((target) => {
                const key = targetKey(target);
                const selected = quizSelectedKeys.length === 0 || quizSelectedKeys.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleQuizTarget(target)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${
                      selected ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                      }`}
                    >
                      {selected && <Check size={13} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {quizSubject === 'All Subjects' ? `${target.subject} - ${target.chapter}` : target.chapter}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[5, 10, 15].map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => setQuizLength(length as 5 | 10 | 15)}
                  className={`min-h-[44px] rounded-2xl text-sm font-black ${
                    quizLength === length ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {length} Qs
                </button>
              ))}
            </div>
            <Button
              className="mt-4 bg-primary shadow-lg"
              fullWidth
              disabled={quizLoading || selectedQuizTargets.length === 0}
              onClick={() => void generateQuizSet()}
            >
              {quizLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Building Quiz...
                </>
              ) : (
                'Start Timed Quiz'
              )}
            </Button>
            {selectedQuizTargets.length === 0 && (
              <p className="mt-2 text-center text-xs font-semibold text-amber-700">
                Select at least one chapter to start a quiz.
              </p>
            )}
          </Card>
        )}

        {practiceMode === 'revision' && (
          <Card className="p-4" noTap>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Target size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Revision mode</p>
                <h2 className="text-lg font-black text-foreground">Smart review list</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The app picks weak or unpracticed chapters and explains why.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {revisionItems.map((item) => (
                <div key={targetKey(item)} className="rounded-2xl border border-border bg-background p-3">
                  <p className="text-sm font-bold text-foreground">
                    {item.subject} - {item.chapter}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
                </div>
              ))}
            </div>
            <Button
              className="mt-4 bg-primary shadow-lg"
              fullWidth
              disabled={isLoading || revisionItems.length === 0}
              onClick={() => void generateRevisionSet()}
            >
              {isLoading && activeSessionType === 'revision' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Building Revision...
                </>
              ) : (
                'Generate Revision Set'
              )}
            </Button>
          </Card>
        )}

        {error && (
          <Card className="border-amber-200 bg-amber-50 p-4" noTap>
            <p className="text-sm font-semibold text-amber-900">{error}</p>
            <Button className="mt-3" variant="outline" fullWidth onClick={() => generatePracticeSet()}>
              Try Again
            </Button>
          </Card>
        )}

        {isLoading && (
          <Card className="p-5 text-center" noTap>
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-primary" />
            <p className="font-semibold text-foreground">Creating board-style practice...</p>
            <p className="mt-1 text-sm text-muted-foreground">This usually takes a few seconds.</p>
          </Card>
        )}

        {quizError && practiceMode === 'quiz' && (
          <Card className="border-amber-200 bg-amber-50 p-4" noTap>
            <p className="text-sm font-semibold text-amber-900">{quizError}</p>
            <Button className="mt-3" variant="outline" fullWidth onClick={() => void generateQuizSet()}>
              Try Quiz Again
            </Button>
          </Card>
        )}

        {quizSet && practiceMode === 'quiz' && (
          <Card className="p-4" noTap>
            {!quizComplete ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-bold text-foreground">
                    Question {quizIndex + 1}/{quizMcqs.length}
                  </p>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm font-black ${
                      quizSecondsLeft <= 10 ? 'bg-red-50 text-red-700' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    0:{quizSecondsLeft.toString().padStart(2, '0')}
                  </div>
                </div>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${((quizIndex + 1) / Math.max(1, quizMcqs.length)) * 100}%` }}
                  />
                </div>
                <p className={`mb-4 text-base font-semibold leading-relaxed text-foreground ${rtlTextClass(quizMcqs[quizIndex]?.question ?? '')}`}>
                  {quizMcqs[quizIndex]?.question}
                </p>
                <div className="space-y-2">
                  {(quizMcqs[quizIndex]?.options ?? []).slice(0, 4).map((option, index) => (
                    <button
                      key={`${option}-${index}`}
                      type="button"
                      onClick={() => advanceQuiz(index)}
                      className={`flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors active:bg-primary/10 ${rtlTextClass(option)}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-black">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{optionText(option)}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
                  Explanations unlock after the quiz.
                </p>
              </>
            ) : (
              <div>
                <div className="text-center">
                  <h2 className="text-xl font-black text-foreground">Quiz Results</h2>
                  <p className="mt-2 text-4xl font-black text-primary">
                    {quizScore}/{quizMcqs.length}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scorePercent(quizScore, quizMcqs.length)}% correct in {quizDurationSeconds}s
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {quizMcqs.map((item, index) => {
                    const selectedIndex = quizAnswers[index] ?? -1;
                    const wasCorrect = selectedIndex === item.correctIndex;
                    return (
                      <div key={`${item.question}-${index}`} className="rounded-2xl border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Question {index + 1}
                          </p>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-black ${
                              wasCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {wasCorrect ? 'Correct' : selectedIndex < 0 ? 'Unanswered' : 'Incorrect'}
                          </span>
                        </div>
                        <p className={`text-sm font-semibold text-foreground ${rtlTextClass(item.question)}`}>{item.question}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Your answer:{' '}
                          <span className="font-bold text-foreground">
                            {selectedIndex >= 0 ? optionText(item.options[selectedIndex] ?? 'Unknown') : 'Not answered'}
                          </span>
                        </p>
                        {!wasCorrect && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Correct answer:{' '}
                            <span className="font-bold text-emerald-700">
                              {optionText(item.options[item.correctIndex] ?? 'Unknown')}
                            </span>
                          </p>
                        )}
                        <p className={`mt-2 rounded-2xl bg-secondary p-3 text-xs text-muted-foreground ${rtlTextClass(item.explanation)}`}>
                          {item.explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <Button className="mt-4" fullWidth onClick={() => void generateQuizSet()}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  New Quiz
                </Button>
              </div>
            )}
          </Card>
        )}

        {practiceSet && practiceMode !== 'quiz' && (
          <div className="space-y-5">
            {currentMcqs.length > 0 && (
              <Card className="p-4" noTap>
                {!mcqComplete ? (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-bold text-foreground">
                        MCQ {mcqIndex + 1}/{currentMcqs.length}
                      </p>
                      <p className="text-xs font-bold text-primary">
                        {mcqScore}/{currentMcqs.length} correct
                      </p>
                    </div>
                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${((mcqIndex + 1) / currentMcqs.length) * 100}%` }}
                      />
                    </div>
                    <p className={`mb-4 text-base font-semibold leading-relaxed text-foreground ${rtlTextClass(currentMcq.question)}`}>
                      {currentMcq.question}
                    </p>
                    <div className="space-y-2">
                      {currentMcq.options.slice(0, 4).map((option, index) => {
                        const answered = currentAnswer !== undefined;
                        const isCorrect = index === currentMcq.correctIndex;
                        const isPicked = currentAnswer === index;
                        return (
                          <button
                            key={`${option}-${index}`}
                            type="button"
                            disabled={answered}
                            onClick={() => setMcqAnswers((prev) => ({ ...prev, [mcqIndex]: index }))}
                            className={`flex min-h-[44px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${rtlTextClass(option)} ${
                              answered && isCorrect
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : answered && isPicked
                                ? 'border-red-300 bg-red-50 text-red-800'
                                : 'border-border bg-background text-foreground'
                            }`}
                          >
                            {answered && isCorrect ? <Check size={16} /> : answered && isPicked ? <X size={16} /> : null}
                            <span>{optionText(option)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {currentAnswer !== undefined && (
                      <div className="mt-4 rounded-2xl bg-secondary p-3">
                        <p className="text-sm font-semibold text-foreground">Explanation</p>
                        <p className={`mt-1 text-sm text-muted-foreground ${rtlTextClass(currentMcq.explanation)}`}>{currentMcq.explanation}</p>
                        <Button
                          className="mt-3"
                          fullWidth
                          onClick={() => setMcqIndex((value) => Math.min(value + 1, currentMcqs.length - 1))}
                        >
                          {mcqIndex === currentMcqs.length - 1 ? 'See Summary' : 'Next MCQ'}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <AnimatePresence>{celebrate && <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />}</AnimatePresence>
                    <h2 className="text-xl font-black text-foreground">MCQ Summary</h2>
                    <p className="mt-2 text-3xl font-black text-primary">
                      {mcqScore}/{currentMcqs.length}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {Math.round((mcqScore / currentMcqs.length) * 100)}% correct
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={retryMcqs}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Retry
                      </Button>
                      <Button onClick={() => activeSessionType === 'revision' ? void generateRevisionSet() : void generatePracticeSet()}>
                        New Set
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {(['shortQuestions', 'longQuestions'] as const).map((key) => {
              const items = practiceSet[key] ?? [];
              if (!items.length) return null;
              return (
                <Card key={key} className="p-4" noTap>
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                    <FileQuestion size={18} />
                    {key === 'shortQuestions' ? 'Short Questions' : 'Long Questions'}
                  </h2>
                  <div className="space-y-3">
                    {items.map((item, index) => {
                      const answerKey = `${key}-${index}`;
                      return (
                        <div key={answerKey} className="rounded-2xl border border-border bg-background p-3">
                          <p className={`text-sm font-semibold text-foreground ${rtlTextClass(item.question)}`}>{item.question}</p>
                          <textarea
                            rows={3}
                            placeholder="Write your answer here..."
                            className="mt-3 w-full resize-none rounded-2xl bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <Button
                            className="mt-2"
                            variant="outline"
                            fullWidth
                            onClick={() =>
                              setRevealedAnswers((prev) => ({ ...prev, [answerKey]: !prev[answerKey] }))
                            }
                          >
                            {revealedAnswers[answerKey] ? 'Hide Model Answer' : 'Show Model Answer'}
                          </Button>
                          {revealedAnswers[answerKey] && (
                            <p className={`mt-2 rounded-2xl bg-secondary p-3 text-sm text-muted-foreground ${rtlTextClass(item.modelAnswer)}`}>
                              {item.modelAnswer}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}

            {(practiceSet.definitions ?? []).length > 0 && currentDefinition && (
              <Card className="p-4" noTap>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                  <Layers size={18} />
                  Definitions
                </h2>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-secondary px-3 py-2 text-center">
                    <p className="text-lg font-black text-foreground">{checkedCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Checked</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-center">
                    <p className="text-lg font-black text-emerald-800">{correctDefinitionCount}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Correct</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background p-5 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Define this term
                  </p>
                  <p className={`mt-3 text-lg font-bold text-foreground ${rtlTextClass(currentDefinition.term)}`}>
                    {currentDefinition.term}
                  </p>
                </div>
                <textarea
                  rows={4}
                  value={definitionAnswers[currentDefinitionKey] ?? ''}
                  onChange={(event) =>
                    setDefinitionAnswers((prev) => ({
                      ...prev,
                      [currentDefinitionKey]: event.target.value,
                    }))
                  }
                  placeholder="Write the definition in your own words..."
                  className="mt-3 w-full resize-none rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {definitionError && (
                  <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    {definitionError}
                  </p>
                )}
                {currentDefinitionCheck && (
                  <div
                    className={`mt-3 rounded-2xl border p-3 ${
                      currentDefinitionCheck.correct
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-red-200 bg-red-50 text-red-900'
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-bold">
                      {currentDefinitionCheck.correct ? <Check size={16} /> : <X size={16} />}
                      {currentDefinitionCheck.correct ? 'Yes, this is correct.' : 'Not quite yet.'}
                    </p>
                    <p className={`mt-1 text-sm ${rtlTextClass(currentDefinitionCheck.feedback)}`}>{currentDefinitionCheck.feedback}</p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide opacity-80">Model answer</p>
                    <p className={`mt-1 text-sm ${rtlTextClass(currentDefinitionCheck.modelAnswer)}`}>{currentDefinitionCheck.modelAnswer}</p>
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={checkingDefinitionKey === currentDefinitionKey}
                    onClick={() => checkDefinitionAnswer(currentDefinition)}
                  >
                    {checkingDefinitionKey === currentDefinitionKey ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking
                      </>
                    ) : (
                      'Check Answer'
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setDefinitionIndex((value) =>
                        (value + 1) % Math.max(1, practiceSet.definitions?.length ?? 1),
                      );
                      setDefinitionError(null);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        <Card className="p-4" noTap>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <ListChecks size={18} />
            Practice History
          </h2>
          {practiceHistory.length > 2 && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {[
                ['all', 'All'],
                ['week', 'This Week'],
                ['subject', 'Subject'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHistoryFilter(value as 'all' | 'week' | 'subject')}
                  className={`min-h-[36px] rounded-xl text-xs font-bold ${
                    historyFilter === value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {sortedHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MCQ attempts yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedHistory.slice(0, 8).map((attempt) => (
                <button
                  key={attempt.id}
                  type="button"
                  onClick={() => setSelectedAttempt(attempt)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-3 text-left"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl">
                    <SubjectIcon subject={attempt.subject} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${HISTORY_TYPE_STYLES[attemptType(attempt)]}`}>
                        {attemptType(attempt)}
                      </span>
                      {attempt.durationSeconds && (
                        <span className="text-[10px] font-bold text-muted-foreground">{attempt.durationSeconds}s</span>
                      )}
                    </div>
                    <p className="truncate text-sm font-bold text-foreground">{attempt.subject} - {attempt.chapter}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(attempt.date), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-black ${scoreTone(attempt.score, attempt.total)}`}>
                    {scorePercent(attempt.score, attempt.total)}%
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
      <AnimatePresence>
        {selectedAttempt && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAttempt(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="mb-3 max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedAttempt(null)}
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
                    aria-label="Close practice detail"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {attemptType(selectedAttempt)} session
                  </p>
                  <h2 className="text-xl font-black text-foreground">{selectedAttempt.chapter}</h2>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{selectedAttempt.subject}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(selectedAttempt.date).toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-2xl border px-3 py-2 text-center ${scoreTone(selectedAttempt.score, selectedAttempt.total)}`}>
                  <p className="text-2xl font-black">{scorePercent(selectedAttempt.score, selectedAttempt.total)}%</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide">
                    {selectedAttempt.score}/{selectedAttempt.total}
                  </p>
                </div>
              </div>

              {selectedAttempt.revisionReasons?.length ? (
                <div className="mb-4 rounded-2xl bg-amber-50 p-3 text-amber-900">
                  <p className="text-xs font-bold uppercase tracking-wide">Why this revision was picked</p>
                  <div className="mt-2 space-y-1">
                    {selectedAttempt.revisionReasons.map((reason) => (
                      <p key={reason} className="text-xs font-semibold">
                        {reason}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedAttempt.questionsAndAnswers?.length ? (
                <div className="space-y-3">
                  {selectedAttempt.questionsAndAnswers.map((item, index) => (
                    <div key={`${item.question}-${index}`} className="rounded-2xl border border-border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Question {index + 1}
                        </p>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-black ${
                            item.wasCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {item.wasCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{item.question}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Your answer:{' '}
                        <span className="font-bold text-foreground">
                          {item.selectedIndex >= 0 ? optionText(item.options[item.selectedIndex] ?? 'Unknown') : 'Not answered'}
                        </span>
                      </p>
                      {!item.wasCorrect && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Correct answer:{' '}
                          <span className="font-bold text-emerald-700">
                            {optionText(item.options[item.correctIndex] ?? 'Unknown')}
                          </span>
                        </p>
                      )}
                      <p className="mt-2 rounded-2xl bg-secondary p-3 text-xs text-muted-foreground">
                        {item.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
                  Detailed breakdown is not available for this older attempt.
                </p>
              )}

              {attemptType(selectedAttempt) === 'chapter' && (
                <Button
                  className="mt-4"
                  fullWidth
                  onClick={() => {
                    const retrySubject = selectedAttempt.subject;
                    const retryChapter = selectedAttempt.chapter;
                    setSelectedAttempt(null);
                    setPracticeMode('chapter');
                    void generatePracticeSet({ subject: retrySubject, chapter: retryChapter });
                  }}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Retry This Chapter
                </Button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
