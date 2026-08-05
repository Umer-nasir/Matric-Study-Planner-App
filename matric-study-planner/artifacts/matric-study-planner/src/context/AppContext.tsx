import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { SYLLABUS_DATA } from '@/data/syllabusData';
import type { AiSchedule } from '@/types/schedule';
import { addDaysDateOnly, daysUntilDateOnly, todayDateOnly } from '@/lib/dateOnly';
import { useAuthContext } from '@/context/AuthContext';
import {
  hasCompletedOnboarding,
  normalizeCompletedProfile,
  type Profile,
} from '@/lib/onboardingProfile';
import {
  USER_DATA_STORAGE_KEYS,
  getUserDataOwner,
  userDataStorageKey,
  type UserDataStorageKey,
} from '@/lib/userStorage';

export type { Profile } from '@/lib/onboardingProfile';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StudyMode = 'fun' | 'balanced' | 'focus';

export interface ChapterState {
  done: boolean;
  selectedForSchedule: boolean;
}

/** { "Physics": { "Vectors": { done: true, selectedForSchedule: false }, ... }, ... } */
export type ChapterCompletion = Record<string, Record<string, ChapterState>>;

export interface StudyEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: 'test' | 'revision' | 'free' | 'custom';
}

export interface TutorChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  attachment?: {
    name: string;
    kind: 'image' | 'document';
    mimeType: string;
    previewUrl?: string;
  };
}

export interface PracticeAttempt {
  id: string;
  type?: 'chapter' | 'quiz' | 'revision';
  examStyle?: ExamStyleTag;
  subject: string;
  chapter: string;
  date: string;
  score: number;
  total: number;
  totalQuestions?: number;
  durationSeconds?: number;
  revisionReasons?: string[];
  chapters?: Array<{ subject: string; chapter: string }>;
  questionsAndAnswers?: Array<{
    question: string;
    options: string[];
    selectedIndex: number;
    correctIndex: number;
    explanation: string;
    wasCorrect: boolean;
  }>;
  definitionChecks?: Array<{
    term: string;
    studentAnswer: string;
    correct: boolean;
    feedback: string;
    modelAnswer: string;
  }>;
}

export type ExamStyleTag =
  | 'past-paper'
  | 'board-mcq'
  | 'short-question'
  | 'long-question'
  | 'tashreeh'
  | 'application';

export interface ReminderSettings {
  enabled: boolean;
  time: string;
  lastShownDate?: string;
}

export interface AppContextType {
  // Profile
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  clearProfile: () => void;
  resetProgress: () => void;

  // Mode
  currentMode: StudyMode;

  // Streak
  streak: number;
  lastStudiedDate: string | null;
  recordStudyActivity: () => void;

  // Badges
  earnedBadges: string[];
  pendingBadges: string[];
  unlockBadge: (id: string) => void;
  dismissPendingBadge: () => void;

  // Chapter completion
  chapterCompletion: ChapterCompletion;
  toggleChapter: (subject: string, chapter: string) => void;
  toggleChapterScheduleSelection: (subject: string, chapter: string) => void;
  setSubjectScheduleSelection: (subject: string, selected: boolean) => void;
  markScheduleSelectionConfigured: () => void;
  scheduleSelectionConfigured: boolean;
  selectedScheduleChapterCount: number;

  // Overall progress (0–100, derived from real chapter data)
  overallProgress: number;

  // AI Schedule
  aiSchedule: AiSchedule | null;
  setAiSchedule: (s: AiSchedule | null) => void;

  // AI Tutor
  tutorChatHistory: TutorChatMessage[];
  setTutorChatHistory: (messages: TutorChatMessage[]) => void;
  clearTutorChatHistory: () => void;

  // Practice
  practiceHistory: PracticeAttempt[];
  addPracticeAttempt: (attempt: Omit<PracticeAttempt, 'id' | 'date'>) => void;

  // Events
  events: StudyEvent[];
  addEvent: (event: Omit<StudyEvent, 'id'>) => void;
  removeEvent: (id: string) => void;

  // Reminders
  reminderSettings: ReminderSettings;
  setReminderSettings: (settings: ReminderSettings) => void;
  markReminderShown: (date: string) => void;
}

// ─── Mode calculation ─────────────────────────────────────────────────────────

function computeMode(
  profile: Profile | null,
  overallProgress: number,
): StudyMode {
  if (!profile) return 'fun';

  const daysLeft = daysUntilDateOnly(profile.examDate);

  const prepPeriod = 180;
  const daysElapsed = Math.max(0, prepPeriod - Math.max(0, daysLeft));
  const expectedProgress = (daysElapsed / prepPeriod) * 100;
  const isBehindPace = overallProgress > 0 && overallProgress < expectedProgress - 20;

  if (daysLeft < 14 || isBehindPace) return 'focus';
  if (daysLeft <= 30) return 'balanced';
  return 'fun';
}

function todayStr(): string {
  return todayDateOnly();
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not save ${key} to localStorage. The app will keep running.`, error);
  }
}

// ─── Progress helpers ─────────────────────────────────────────────────────────

function computeOverallProgress(
  subjects: string[],
  completion: ChapterCompletion,
): number {
  if (!subjects.length) return 0;
  let total = 0;
  let done = 0;
  for (const subj of subjects) {
    const chapters = SYLLABUS_DATA[subj] ?? [];
    total += chapters.length;
    const subjCompletion = completion[subj] ?? {};
    done += chapters.filter((ch) => subjCompletion[ch]?.done).length;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function buildEmptyCompletion(subjects: string[]): ChapterCompletion {
  const result: ChapterCompletion = {};
  for (const subj of subjects) {
    result[subj] = {};
    for (const ch of SYLLABUS_DATA[subj] ?? []) {
      result[subj][ch] = { done: false, selectedForSchedule: true };
    }
  }
  return result;
}

function normalizeChapterState(value: unknown): ChapterState {
  if (typeof value === 'boolean') {
    return { done: value, selectedForSchedule: !value };
  }
  if (value && typeof value === 'object') {
    const state = value as Partial<ChapterState>;
    const done = Boolean(state.done);
    return {
      done,
      selectedForSchedule:
        typeof state.selectedForSchedule === 'boolean'
          ? state.selectedForSchedule
          : !done,
    };
  }
  return { done: false, selectedForSchedule: true };
}

function normalizeCompletionForSubjects(subjects: string[], storedCompletion: unknown): ChapterCompletion {
  const stored = (storedCompletion ?? {}) as Record<string, Record<string, unknown>>;
  const filled = buildEmptyCompletion(subjects);
  for (const subj of subjects) {
    if (!stored[subj]) continue;
    for (const ch of SYLLABUS_DATA[subj] ?? []) {
      filled[subj][ch] = normalizeChapterState(stored[subj][ch]);
    }
  }
  return filled;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextType | undefined>(undefined);
const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, time: '18:00' };

export function AppContextProvider({ children }: { children: ReactNode }) {
  const { currentUser, isGuest } = useAuthContext();
  const storageOwner = getUserDataOwner(currentUser?.uid, isGuest);
  const [loadedStorageOwner, setLoadedStorageOwner] = useState<string | null | undefined>(undefined);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [streak, setStreak] = useState(0);
  const [lastStudiedDate, setLastStudiedDate] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [pendingBadges, setPendingBadges] = useState<string[]>([]);
  const [chapterCompletion, setChapterCompletion] = useState<ChapterCompletion>({});
  const [scheduleSelectionConfigured, setScheduleSelectionConfigured] = useState(false);
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [aiSchedule, setAiScheduleState] = useState<AiSchedule | null>(null);
  const [tutorChatHistory, setTutorChatHistoryState] = useState<TutorChatMessage[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeAttempt[]>([]);
  const [reminderSettings, setReminderSettingsState] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  const saveUserJSON = useCallback((key: UserDataStorageKey, value: unknown) => {
    if (!storageOwner) return;
    saveJSON(userDataStorageKey(storageOwner, key), value);
  }, [storageOwner]);

  const removeUserItem = useCallback((key: UserDataStorageKey) => {
    if (!storageOwner) return;
    try {
      localStorage.removeItem(userDataStorageKey(storageOwner, key));
    } catch {
      // State remains authoritative if browser storage is unavailable.
    }
  }, [storageOwner]);

  const clearUserStorage = useCallback(() => {
    if (!storageOwner) return;
    for (const key of USER_DATA_STORAGE_KEYS) {
      try {
        localStorage.removeItem(userDataStorageKey(storageOwner, key));
      } catch {
        // Continue clearing the in-memory state below.
      }
    }
  }, [storageOwner]);

  // Rehydrate whenever the active identity changes. Unscoped legacy keys are deliberately
  // ignored because their owner cannot be determined safely.
  useEffect(() => {
    setProfileState(null);
    setStreak(0);
    setLastStudiedDate(null);
    setEarnedBadges([]);
    setPendingBadges([]);
    setChapterCompletion({});
    setScheduleSelectionConfigured(false);
    setEvents([]);
    setAiScheduleState(null);
    setTutorChatHistoryState([]);
    setPracticeHistory([]);
    setReminderSettingsState(DEFAULT_REMINDER_SETTINGS);

    if (!storageOwner) {
      setLoadedStorageOwner(null);
      return;
    }

    const key = (baseKey: UserDataStorageKey) => userDataStorageKey(storageOwner, baseKey);
    const storedProfile = normalizeCompletedProfile(loadJSON<unknown>(key('matric_profile'), null));

    if (!storedProfile || !hasCompletedOnboarding(storedProfile)) {
      setLoadedStorageOwner(storageOwner);
      return;
    }

    setProfileState(storedProfile);
    saveJSON(key('matric_profile'), storedProfile);

    const streakData = loadJSON<{ count: number; lastDate: string | null }>(
      key('matric_streak'),
      { count: 0, lastDate: null },
    );
    setStreak(streakData.count);
    setLastStudiedDate(streakData.lastDate);

    const badges = loadJSON<string[]>(key('matric_badges'), []);
    setEarnedBadges(badges);

    const evts = loadJSON<StudyEvent[]>(key('matric_events'), []);
    setEvents(evts);

    const storedCompletion = loadJSON<unknown>(key('matric_chapters'), {});
    const filled = normalizeCompletionForSubjects(storedProfile.subjects, storedCompletion);
    setChapterCompletion(filled);
    saveJSON(key('matric_chapters'), filled);

    setScheduleSelectionConfigured(loadJSON<boolean>(key('matric_schedule_selection_configured'), false));

    const storedSchedule = loadJSON<AiSchedule | null>(key('matric_ai_schedule'), null);
    if (storedSchedule) setAiScheduleState(storedSchedule);

    const storedTutorHistory = loadJSON<TutorChatMessage[]>(key('tutorChatHistory'), []);
    setTutorChatHistoryState(storedTutorHistory);

    const storedPracticeHistory = loadJSON<PracticeAttempt[]>(key('matric_practice_history'), []);
    setPracticeHistory(storedPracticeHistory);

    const storedReminders = loadJSON<ReminderSettings>(key('matric_reminder_settings'), DEFAULT_REMINDER_SETTINGS);
    setReminderSettingsState({
      enabled: Boolean(storedReminders.enabled),
      time: storedReminders.time || DEFAULT_REMINDER_SETTINGS.time,
      lastShownDate: storedReminders.lastShownDate,
    });

    setLoadedStorageOwner(storageOwner);
  }, [storageOwner]);

  const isLoaded = loadedStorageOwner === storageOwner;

  // ── Profile ──────────────────────────────────────────────────────────────

  const setProfile = useCallback((p: Profile) => {
    const boardLocked = Boolean(profile && p.board !== profile.board);
    const nextProfile = normalizeCompletedProfile(boardLocked ? { ...p, board: profile!.board } : p);
    if (boardLocked) {
      console.warn('Board is locked after onboarding. Reset progress to choose a different board.');
    }
    if (!nextProfile) return;

    if (!profile) {
      clearUserStorage();
      setStreak(0);
      setLastStudiedDate(null);
      setEarnedBadges([]);
      setPendingBadges([]);
      setScheduleSelectionConfigured(false);
      setEvents([]);
      setAiScheduleState(null);
      setTutorChatHistoryState([]);
      setPracticeHistory([]);
      setReminderSettingsState(DEFAULT_REMINDER_SETTINGS);
    }

    saveUserJSON('matric_profile', nextProfile);
    setProfileState(nextProfile);
    setChapterCompletion((prev) => {
      const next = profile ? { ...prev } : {};
      for (const subj of nextProfile.subjects) {
        if (!next[subj]) {
          next[subj] = {};
          for (const ch of SYLLABUS_DATA[subj] ?? []) {
            next[subj][ch] = { done: false, selectedForSchedule: true };
          }
        } else {
          for (const ch of SYLLABUS_DATA[subj] ?? []) {
            next[subj][ch] = normalizeChapterState(next[subj][ch]);
          }
        }
      }
      saveUserJSON('matric_chapters', next);
      return next;
    });
  }, [clearUserStorage, profile, saveUserJSON]);

  const clearProfile = useCallback(() => {
    removeUserItem('matric_profile');
    setProfileState(null);
  }, [removeUserItem]);

  const resetProgress = useCallback(() => {
    clearUserStorage();
    setProfileState(null);
    setChapterCompletion({});
    setScheduleSelectionConfigured(false);
    setStreak(0);
    setLastStudiedDate(null);
    setEarnedBadges([]);
    setPendingBadges([]);
    setAiScheduleState(null);
    setTutorChatHistoryState([]);
    setPracticeHistory([]);
    setEvents([]);
    setReminderSettingsState(DEFAULT_REMINDER_SETTINGS);
  }, [clearUserStorage]);

  // ── Computed progress ─────────────────────────────────────────────────────

  const overallProgress = useMemo(
    () => computeOverallProgress(profile?.subjects ?? [], chapterCompletion),
    [profile?.subjects, chapterCompletion],
  );

  // ── Mode ─────────────────────────────────────────────────────────────────

  const currentMode = useMemo(
    () => computeMode(profile, overallProgress),
    [profile, overallProgress],
  );

  const selectedScheduleChapterCount = useMemo(() => {
    if (!profile) return 0;
    let count = 0;
    for (const subject of profile.subjects) {
      for (const chapter of SYLLABUS_DATA[subject] ?? []) {
        const state = normalizeChapterState(chapterCompletion[subject]?.[chapter]);
        if (!state.done && state.selectedForSchedule) count += 1;
      }
    }
    return count;
  }, [chapterCompletion, profile]);

  // ── Badges ───────────────────────────────────────────────────────────────

  const earnedBadgesRef = React.useRef(earnedBadges);
  useEffect(() => { earnedBadgesRef.current = earnedBadges; }, [earnedBadges]);

  const unlockBadge = useCallback((id: string) => {
    if (earnedBadgesRef.current.includes(id)) return;
    setEarnedBadges((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveUserJSON('matric_badges', next);
      return next;
    });
    setPendingBadges((q) => [...q, id]);
  }, [saveUserJSON]);

  const dismissPendingBadge = useCallback(() => {
    setPendingBadges((q) => q.slice(1));
  }, []);

  useEffect(() => {
    const hasCompletedChapter = Object.values(chapterCompletion)
      .flatMap(Object.values)
      .some((state) => normalizeChapterState(state).done);

    if (hasCompletedChapter) {
      unlockBadge('first_chapter');
    }
  }, [chapterCompletion, unlockBadge]);

  // ── Streak ───────────────────────────────────────────────────────────────

  const recordStudyActivity = useCallback(() => {
    const today = todayStr();
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 4) unlockBadge('night_owl');
    if (lastStudiedDate === today) return;

    const yesterday = addDaysDateOnly(-1);
    const daysSinceLast = lastStudiedDate
      ? Math.round(
          (new Date(today).getTime() - new Date(lastStudiedDate).getTime()) / 86400000,
        )
      : 999;

    let newStreak: number;
    if (daysSinceLast >= 3 && streak > 0) {
      newStreak = 1;
      unlockBadge('comeback_kid');
    } else if (lastStudiedDate === yesterday || daysSinceLast <= 1) {
      newStreak = streak + 1;
    } else {
      newStreak = 1;
    }

    if (hour < 9) unlockBadge('early_bird');
    if (newStreak >= 3) unlockBadge('three_day_streak');
    if (newStreak >= 7) unlockBadge('seven_day_streak');

    setStreak(newStreak);
    setLastStudiedDate(today);
    saveUserJSON('matric_streak', { count: newStreak, lastDate: today });
  }, [lastStudiedDate, saveUserJSON, streak, unlockBadge]);

  // ── Chapter completion ────────────────────────────────────────────────────

  const toggleChapter = useCallback(
    (subject: string, chapter: string) => {
      setChapterCompletion((prev) => {
        const prevState = normalizeChapterState(prev[subject]?.[chapter]);
        const prevDone = prevState.done;
        const nextState: ChapterState = {
          ...prevState,
          done: !prevDone,
          selectedForSchedule: prevDone ? true : false,
        };
        const next: ChapterCompletion = {
          ...prev,
          [subject]: { ...prev[subject], [chapter]: nextState },
        };
        saveUserJSON('matric_chapters', next);

        if (!prevDone) {
          const totalDoneBefore = Object.values(prev)
            .flatMap(Object.values)
            .filter((state) => normalizeChapterState(state).done).length;
          if (totalDoneBefore === 0) unlockBadge('first_chapter');

          const subjectChapters = SYLLABUS_DATA[subject] ?? [];
          const allDone = subjectChapters.every(
            (ch) => (ch === chapter ? true : Boolean(next[subject]?.[ch]?.done)),
          );
          if (allDone) unlockBadge('subject_master');

          const subjects = Object.keys(next);
          const prog = computeOverallProgress(subjects, next);
          if (prog >= 50) unlockBadge('halfway_hero');
        }

        return next;
      });

      recordStudyActivity();
    },
    [recordStudyActivity, saveUserJSON, unlockBadge],
  );

  const toggleChapterScheduleSelection = useCallback((subject: string, chapter: string) => {
    setChapterCompletion((prev) => {
      const prevState = normalizeChapterState(prev[subject]?.[chapter]);
      if (prevState.done) return prev;
      const next: ChapterCompletion = {
        ...prev,
        [subject]: {
          ...prev[subject],
          [chapter]: {
            ...prevState,
            selectedForSchedule: !prevState.selectedForSchedule,
          },
        },
      };
      saveUserJSON('matric_chapters', next);
      return next;
    });
  }, [saveUserJSON]);

  const setSubjectScheduleSelection = useCallback((subject: string, selected: boolean) => {
    setChapterCompletion((prev) => {
      const chapters = SYLLABUS_DATA[subject] ?? [];
      const nextSubject = { ...prev[subject] };
      for (const chapter of chapters) {
        const state = normalizeChapterState(nextSubject[chapter]);
        nextSubject[chapter] = {
          ...state,
          selectedForSchedule: state.done ? false : selected,
        };
      }
      const next: ChapterCompletion = { ...prev, [subject]: nextSubject };
      saveUserJSON('matric_chapters', next);
      return next;
    });
  }, [saveUserJSON]);

  const markScheduleSelectionConfigured = useCallback(() => {
    setScheduleSelectionConfigured(true);
    saveUserJSON('matric_schedule_selection_configured', true);
  }, [saveUserJSON]);

  // ── AI Schedule ───────────────────────────────────────────────────────────

  const setAiSchedule = useCallback((s: AiSchedule | null) => {
    setAiScheduleState(s);
    if (s) {
      saveUserJSON('matric_ai_schedule', s);
    } else {
      removeUserItem('matric_ai_schedule');
    }
  }, [removeUserItem, saveUserJSON]);

  // ── AI Tutor ───────────────────────────────────────────────────────────────

  const setTutorChatHistory = useCallback((messages: TutorChatMessage[]) => {
    setTutorChatHistoryState(messages);
    saveUserJSON('tutorChatHistory', messages);
  }, [saveUserJSON]);

  const clearTutorChatHistory = useCallback(() => {
    setTutorChatHistoryState([]);
    removeUserItem('tutorChatHistory');
  }, [removeUserItem]);

  const addPracticeAttempt = useCallback((attempt: Omit<PracticeAttempt, 'id' | 'date'>) => {
    const nextAttempt: PracticeAttempt = {
      ...attempt,
      totalQuestions: attempt.totalQuestions ?? attempt.total,
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: new Date().toISOString(),
    };

    setPracticeHistory((prev) => {
      const next = [nextAttempt, ...prev].slice(0, 30);
      saveUserJSON('matric_practice_history', next);

      const pct = nextAttempt.total > 0 ? nextAttempt.score / nextAttempt.total : 0;
      if (pct >= 0.9) unlockBadge('test_hero');
      if (pct === 1 && nextAttempt.total >= 5) unlockBadge('perfectionist');
      if (next.length >= 10) unlockBadge('practice_makes_perfect');

      const hadWeakAttempt = prev.some(
        (item) =>
          item.subject === nextAttempt.subject &&
          item.chapter === nextAttempt.chapter &&
          item.total > 0 &&
          item.score / item.total < 0.5,
      );
      if (hadWeakAttempt && pct >= 0.8) unlockBadge('comeback_scholar');

      return next;
    });
    recordStudyActivity();
  }, [recordStudyActivity, saveUserJSON, unlockBadge]);

  // ── Events ───────────────────────────────────────────────────────────────

  const addEvent = useCallback(
    (event: Omit<StudyEvent, 'id'>) => {
      const next = [...events, { ...event, id: Date.now().toString() }];
      setEvents(next);
      saveUserJSON('matric_events', next);
      unlockBadge('planner_pro');
    },
    [events, saveUserJSON, unlockBadge],
  );

  const removeEvent = useCallback(
    (id: string) => {
      const next = events.filter((e) => e.id !== id);
      setEvents(next);
      saveUserJSON('matric_events', next);
    },
    [events, saveUserJSON],
  );

  const setReminderSettings = useCallback((settings: ReminderSettings) => {
    const next = {
      enabled: Boolean(settings.enabled),
      time: settings.time || DEFAULT_REMINDER_SETTINGS.time,
      lastShownDate: settings.lastShownDate,
    };
    setReminderSettingsState(next);
    saveUserJSON('matric_reminder_settings', next);
  }, [saveUserJSON]);

  const markReminderShown = useCallback((date: string) => {
    setReminderSettingsState((prev) => {
      const next = { ...prev, lastShownDate: date };
      saveUserJSON('matric_reminder_settings', next);
      return next;
    });
  }, [saveUserJSON]);

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background shadow-[0_0_40px_rgba(0,0,0,0.05)] flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <div className="mx-auto h-9 w-9 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div>
            <p className="font-bold text-foreground">Matric Study Planner</p>
            <p className="text-sm text-muted-foreground">Preparing your study space...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        profile,
        setProfile,
        clearProfile,
        resetProgress,
        currentMode,
        streak,
        lastStudiedDate,
        recordStudyActivity,
        earnedBadges,
        pendingBadges,
        unlockBadge,
        dismissPendingBadge,
        chapterCompletion,
        toggleChapter,
        toggleChapterScheduleSelection,
        setSubjectScheduleSelection,
        markScheduleSelectionConfigured,
        scheduleSelectionConfigured,
        selectedScheduleChapterCount,
        overallProgress,
        aiSchedule,
        setAiSchedule,
        tutorChatHistory,
        setTutorChatHistory,
        clearTutorChatHistory,
        practiceHistory,
        addPracticeAttempt,
        events,
        addEvent,
        removeEvent,
        reminderSettings,
        setReminderSettings,
        markReminderShown,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContextProvider');
  return ctx;
}
