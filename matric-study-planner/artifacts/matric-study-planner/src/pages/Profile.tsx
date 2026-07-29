import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  GraduationCap,
  Lock,
  LogOut,
  RotateCcw,
  Save,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { GoogleIcon } from '@/components/GoogleIcon';
import { ModeIndicator } from '@/components/ModeIndicator';
import { SubjectIcon } from '@/components/SubjectIcon';
import { useAppContext } from '@/context/AppContext';
import { useAuthContext } from '@/context/AuthContext';
import { SUBJECTS } from '@/data/syllabus';
import { SYLLABUS_DATA } from '@/data/syllabusData';
import { MILESTONES } from '@/data/milestones';
import type { StudyMode } from '@/context/AppContext';
import {
  dateInputValueToExamDate,
  dateOnlyToLocalDate,
  daysUntilDateOnly,
  examDateToLocalDate,
  todayDateOnly,
  toDateInputValue,
} from '@/lib/dateOnly';
import {
  canChooseSubjectLanguage,
  defaultSubjectLanguage,
  normalizeSubjectLanguages,
  subjectDirectionClass,
  subjectDisplayName,
  type SubjectStudyLanguage,
} from '@/lib/subjectLanguage';

const MODE_OPTIONS: { value: StudyMode | null; label: string; icon: string; cls: string }[] = [
  { value: 'fun', label: 'Fun', icon: '🎉', cls: 'border-violet-300 bg-violet-50 text-violet-700' },
  { value: 'balanced', label: 'Balanced', icon: '⚡', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
  { value: 'focus', label: 'Focus', icon: '🎯', cls: 'border-red-300 bg-red-50 text-red-700' },
  { value: null, label: 'Auto', icon: 'A', cls: 'border-gray-300 bg-gray-50 text-gray-700' },
];

export default function Profile() {
  const {
    profile,
    setProfile,
    resetProgress,
    streak,
    simulatedMode,
    setSimulatedMode,
    setStreakForDemo,
    earnedBadges,
    chapterCompletion,
  } = useAppContext();
  const { currentUser, isGuest, signInWithGoogle, signOut } = useAuthContext();
  const [, setLocation] = useLocation();
  const [showDev, setShowDev] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [draftExamDate, setDraftExamDate] = useState('');
  const [draftSubjects, setDraftSubjects] = useState<string[]>([]);
  const [draftSubjectLanguages, setDraftSubjectLanguages] = useState<Record<string, SubjectStudyLanguage>>({});
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDraftExamDate(toDateInputValue(profile.examDate));
    setDraftSubjects(profile.subjects);
    setDraftSubjectLanguages(normalizeSubjectLanguages(profile.subjects, profile.subjectLanguages));
  }, [profile]);

  const totals = useMemo(() => {
    const subjects = profile?.subjects ?? [];
    let total = 0;
    let completed = 0;

    for (const subject of subjects) {
      const chapters = SYLLABUS_DATA[subject] ?? [];
      total += chapters.length;
      completed += chapters.filter((chapter) => chapterCompletion[subject]?.[chapter]?.done).length;
    }

    return {
      total,
      completed,
      progress: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }, [chapterCompletion, profile?.subjects]);

  if (!profile) return null;

  const daysLeft = Math.max(0, daysUntilDateOnly(profile.examDate));
  const hasProfileChanges =
    draftExamDate !== toDateInputValue(profile.examDate) ||
    draftSubjects.join('|') !== profile.subjects.join('|') ||
    JSON.stringify(normalizeSubjectLanguages(draftSubjects, draftSubjectLanguages)) !==
      JSON.stringify(normalizeSubjectLanguages(profile.subjects, profile.subjectLanguages));

  function toggleSubject(subject: string) {
    setProfileMessage(null);
    setDraftSubjects((prev) => {
      if (prev.includes(subject)) {
        setDraftSubjectLanguages((current) => {
          const next = { ...current };
          delete next[subject];
          return next;
        });
        return prev.filter((item) => item !== subject);
      }

      setDraftSubjectLanguages((current) => ({
        ...current,
        [subject]: current[subject] ?? defaultSubjectLanguage(subject),
      }));
      return [...prev, subject];
    });
  }

  function setDraftSubjectLanguage(subject: string, language: SubjectStudyLanguage) {
    setProfileMessage(null);
    setDraftSubjectLanguages((current) => ({
      ...current,
      [subject]: language,
    }));
  }

  function saveProfileChanges() {
    if (!profile) return;
    if (!draftExamDate) {
      setProfileMessage('Please choose an exam date.');
      return;
    }
    if (draftSubjects.length === 0) {
      setProfileMessage('Select at least one subject.');
      return;
    }

    const selected = dateOnlyToLocalDate(draftExamDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected <= today) {
      setProfileMessage('Exam date must be in the future.');
      return;
    }

    setProfile({
      ...profile,
      board: profile.board,
      subjects: draftSubjects,
      subjectLanguages: normalizeSubjectLanguages(draftSubjects, draftSubjectLanguages),
      examDate: dateInputValueToExamDate(draftExamDate),
      onboardingComplete: true,
    });
    setProfileMessage('Profile updated.');
  }

  function confirmResetProgress() {
    resetProgress();
    setShowResetConfirm(false);
    setLocation('/onboarding');
  }

  function simulateExamDate(daysFromToday: number) {
    if (!profile) return;

    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);

    const nextProfile = {
      board: profile.board,
      subjects: profile.subjects,
      subjectLanguages: profile.subjectLanguages,
      examDate: dateInputValueToExamDate(todayDateOnly(date)),
      onboardingComplete: true,
    };
    setProfile(nextProfile);
    setDraftExamDate(toDateInputValue(nextProfile.examDate));
    setSimulatedMode(null);
    setProfileMessage(`Exam date simulated: ${daysFromToday} days left.`);
  }

  async function handleProfileGoogleSignIn() {
    setAuthMessage(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
      setAuthMessage('Signed in with Google.');
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'Google sign-in unavailable, please continue as guest.');
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setLocation('/portal');
  }

  return (
    <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background shadow-[0_0_40px_rgba(0,0,0,0.05)]">
      <div className="px-5 pt-8 pb-32 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">Student settings and demo controls.</p>
          </div>
          <ModeIndicator />
        </div>

        <Card className="p-5" data-testid="card-profile-summary">
          <div className="flex items-start gap-3">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt=""
                className="h-11 w-11 shrink-0 rounded-2xl object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <GraduationCap size={22} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {currentUser ? 'Signed in with Google' : isGuest ? 'Guest User' : 'Matric Study Planner'}
              </p>
              <h2 className="text-lg font-bold text-foreground mt-0.5">
                {currentUser?.name || (isGuest ? 'Guest User' : profile.board)}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {currentUser?.email ||
                  (isGuest
                    ? 'Sign in with Google to save your progress across devices later.'
                    : profile.subjects.length > 0
                    ? `${profile.subjects.length} subject${profile.subjects.length !== 1 ? 's' : ''} selected`
                    : 'No subjects selected')}
              </p>
            </div>
          </div>
          {(isGuest || currentUser) && (
            <div className="mt-4 flex flex-col gap-2">
              {isGuest && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleProfileGoogleSignIn}
                  disabled={isSigningIn}
                  data-testid="button-profile-google-sign-in"
                  className="gap-2 bg-white text-[#3c4043] hover:bg-[#f8fafd]"
                >
                  {!isSigningIn && <GoogleIcon />}
                  {isSigningIn ? 'Opening Google...' : 'Sign in with Google'}
                </Button>
              )}
              <Button
                variant="outline"
                fullWidth
                onClick={handleSignOut}
                data-testid="button-sign-out"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
              {authMessage && (
                <p className="text-center text-xs font-semibold text-muted-foreground">
                  {authMessage}
                </p>
              )}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center" noTap>
            <Calendar className="mx-auto mb-2 h-5 w-5 text-primary" />
            <div className="text-xl font-black text-foreground">{daysLeft}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Days</div>
          </Card>
          <Card className="p-4 text-center" noTap>
            <Check className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
            <div className="text-xl font-black text-foreground">{totals.completed}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Chapters
            </div>
          </Card>
          <Card className="p-4 text-center" noTap>
            <Flame className="mx-auto mb-2 h-5 w-5 text-orange-500" />
            <div className="text-xl font-black text-foreground">{streak}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Streak</div>
          </Card>
        </div>

        <Card className="p-5 space-y-4" noTap>
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">Saved Info</h2>
          </div>

          <div className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Board
            </span>
            <div className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-border bg-secondary/50 px-4">
              <Lock className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{profile.board}</p>
                <p className="text-xs text-muted-foreground">Cannot be changed after onboarding.</p>
              </div>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Exam Date
            </span>
            <input
              type="date"
              value={draftExamDate}
              onChange={(event) => {
                setDraftExamDate(event.target.value);
                setProfileMessage(null);
              }}
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Exam date"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Current exam date: {format(examDateToLocalDate(profile.examDate), 'dd MMMM yyyy')}
            </p>
          </label>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Subjects
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUBJECTS.map((subject) => {
                const selected = draftSubjects.includes(subject);
                const displayName = subjectDisplayName(subject, draftSubjectLanguages);
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    aria-pressed={selected}
                    className={`min-h-[44px] rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      selected
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    <SubjectIcon subject={subject} className="mr-1.5 inline-flex h-4 w-4 align-[-2px]" />
                    <span className={subjectDirectionClass(subject, draftSubjectLanguages)}>
                      {displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {draftSubjects.some(canChooseSubjectLanguage) && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                AI answer language
              </p>
              <div className="space-y-2">
                {draftSubjects.filter(canChooseSubjectLanguage).map((subject) => {
                  const language = draftSubjectLanguages[subject] ?? defaultSubjectLanguage(subject);
                  const displayName = subjectDisplayName(subject, draftSubjectLanguages);
                  return (
                    <div
                      key={subject}
                      className="rounded-2xl border border-border bg-background p-3"
                    >
                      <p className={`mb-2 text-sm font-bold text-foreground ${subjectDirectionClass(subject, draftSubjectLanguages)}`}>
                        {displayName}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['english', 'urdu'] as const).map((option) => {
                          const selected = language === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setDraftSubjectLanguage(subject, option)}
                              className={`min-h-[44px] rounded-2xl border px-3 text-xs font-bold transition-colors ${
                                selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-card text-muted-foreground'
                              }`}
                              data-testid={`profile-subject-language-${subject.replace(/\s+/g, '-').toLowerCase()}-${option}`}
                            >
                              {option === 'english' ? 'English' : 'Urdu'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={saveProfileChanges}
              disabled={!hasProfileChanges}
              className="flex-1"
              data-testid="button-save-profile"
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
          {profileMessage && (
            <p
              className={`text-center text-xs font-semibold ${
                profileMessage.includes('updated') || profileMessage.includes('reset')
                  ? 'text-emerald-700'
                  : 'text-destructive'
              }`}
            >
              {profileMessage}
            </p>
          )}
        </Card>

        <Card className="p-5 space-y-3" noTap>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Badges</h2>
              <p className="text-xs text-muted-foreground">
                {earnedBadges.length}/{MILESTONES.length} earned
              </p>
            </div>
            <Award size={20} className="text-amber-500" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MILESTONES.map((milestone) => {
              const earned = earnedBadges.includes(milestone.id);
              return (
                <div
                  key={milestone.id}
                  className={`rounded-2xl border p-2 text-center ${
                    earned
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-border bg-secondary/30 text-muted-foreground opacity-55'
                  }`}
                  title={milestone.title}
                  data-testid={`profile-badge-${milestone.id}`}
                >
                  <div className="text-xl" aria-hidden>
                    {milestone.icon}
                  </div>
                  <div className="mt-1 truncate text-[9px] font-bold">{milestone.title}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="overflow-hidden rounded-2xl border border-dashed border-muted-foreground/30 bg-card">
          <button
            type="button"
            onClick={() => setShowDev((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground"
            data-testid="button-toggle-dev"
            aria-expanded={showDev}
          >
            <span>Demo controls: simulate exam date</span>
            {showDev ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <AnimatePresence>
            {showDev && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-dashed border-muted-foreground/20 px-4 pb-4 pt-4">
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Simulate exam date</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[7, 21, 90].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => simulateExamDate(days)}
                          data-testid={`button-sim-exam-${days}`}
                          className="min-h-[44px] rounded-2xl border border-primary/30 bg-primary/8 px-2 text-xs font-bold text-primary"
                        >
                          {days} days
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Active mode override</p>
                    <div className="grid grid-cols-2 gap-2">
                      {MODE_OPTIONS.map((opt) => (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setSimulatedMode(opt.value)}
                          data-testid={`button-sim-mode-${opt.value ?? 'auto'}`}
                          className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border px-2 text-xs font-bold transition-all ${
                            simulatedMode === opt.value
                              ? `${opt.cls} ring-2 ring-current ring-offset-1`
                              : 'border-border bg-background text-muted-foreground'
                          }`}
                        >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Simulate streak</p>
                    <div className="flex gap-2">
                      {[1, 3, 7].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setStreakForDemo(n)}
                          data-testid={`button-sim-streak-${n}`}
                          className="min-h-[44px] flex-1 rounded-2xl border border-orange-300 bg-orange-50 px-2 text-xs font-bold text-orange-700"
                        >
                          {n} days
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Card className="p-5 space-y-3 border-destructive/20" noTap>
          <div className="flex items-start gap-3">
            <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-foreground">Reset Progress</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Full fresh start: clears board, subjects, exam date, chapters, streak, badges, AI plans, and tutor chat.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            fullWidth
            onClick={() => setShowResetConfirm(true)}
            className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            data-testid="button-reset-progress"
          >
            Reset Progress
          </Button>
        </Card>

        <footer className="pt-2 text-center text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Matric Study Planner</p>
          <p>Version 1.0.0</p>
        </footer>
      </div>

      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 18 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full max-w-[360px] rounded-2xl border border-card-border bg-card p-5 shadow-2xl"
            >
              <h2 id="reset-title" className="text-lg font-bold text-foreground">
                Are you sure?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                This clears all progress and saved profile info. You will go through onboarding again, including board selection.
              </p>
              <div className="mt-5 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={confirmResetProgress}
                  data-testid="button-confirm-reset-progress"
                >
                  Reset
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
