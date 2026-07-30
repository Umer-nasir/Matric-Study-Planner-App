import React, { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { format } from 'date-fns';
import {
  Award,
  Bell,
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
  ShieldCheck,
  Upload,
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
  subjectDisplayName,
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
    exportBackupData,
    restoreBackupData,
    streak,
    simulatedMode,
    setSimulatedMode,
    setStreakForDemo,
    earnedBadges,
    chapterCompletion,
    reminderSettings,
    setReminderSettings,
  } = useAppContext();
  const { currentUser, isGuest, signInWithGoogle, signOut } = useAuthContext();
  const [, setLocation] = useLocation();
  const [showDev, setShowDev] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [draftExamDate, setDraftExamDate] = useState('');
  const [draftSubjects, setDraftSubjects] = useState<string[]>([]);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  );

  useEffect(() => {
    if (!profile) return;
    setDraftExamDate(toDateInputValue(profile.examDate));
    setDraftSubjects(profile.subjects);
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
    draftSubjects.join('|') !== profile.subjects.join('|');

  function toggleSubject(subject: string) {
    setProfileMessage(null);
    setDraftSubjects((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((item) => item !== subject);
      }

      return [...prev, subject];
    });
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
      examDate: dateInputValueToExamDate(draftExamDate),
      onboardingComplete: true,
    });
    setProfileMessage('Profile updated.');
  }

  function confirmResetProgress() {
    if (resetConfirmText !== 'RESET') return;
    flushSync(() => {
      resetProgress();
      setShowResetConfirm(false);
      setResetConfirmText('');
    });
    setLocation('/onboarding');
  }

  async function requestReminderPermission() {
    if (typeof Notification === 'undefined') {
      setBackupMessage('This browser does not support notifications. In-app reminders will still work.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        setBackupMessage('Notification permission was not granted. Dashboard reminders will still show in-app.');
      }
    } catch {
      setBackupMessage('Could not request notification permission. In-app reminders will still work.');
    }
  }

  function updateReminderEnabled(enabled: boolean) {
    setReminderSettings({ ...reminderSettings, enabled });
    setBackupMessage(enabled ? 'Reminders enabled.' : 'Reminders turned off.');
  }

  function downloadBackup() {
    const backup = exportBackupData();
    const date = todayDateOnly();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `matric-study-planner-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBackupMessage('Backup downloaded. Keep it safe before resetting progress.');
  }

  async function restoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      restoreBackupData(parsed);
      setBackupMessage('Backup restored successfully.');
    } catch (err) {
      setBackupMessage(err instanceof Error ? err.message : 'Could not restore this backup file.');
    }
  }

  function simulateExamDate(daysFromToday: number) {
    if (!profile) return;

    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);

    const nextProfile = {
      board: profile.board,
      subjects: profile.subjects,
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
          const displayName = subjectDisplayName(subject);
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
                    <span>{displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

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

        <Card className="p-5 space-y-4" noTap>
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-foreground">Study Reminders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Get a daily nudge for your next task. Browser notifications work best while the app has been opened recently.
              </p>
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Reminder time
            </span>
            <input
              type="time"
              value={reminderSettings.time}
              onChange={(event) =>
                setReminderSettings({ ...reminderSettings, time: event.target.value || '18:00' })
              }
              className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Daily reminder time"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={reminderSettings.enabled ? 'primary' : 'outline'}
              onClick={() => updateReminderEnabled(!reminderSettings.enabled)}
            >
              {reminderSettings.enabled ? 'Reminders On' : 'Turn On'}
            </Button>
            <Button variant="outline" onClick={requestReminderPermission}>
              Enable Alerts
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Notification permission: <span className="font-bold">{notificationPermission}</span>
          </p>
        </Card>

        <Card className="p-5 space-y-3" noTap>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-foreground">Backup & Restore</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Download a JSON backup before resetting, or restore one on a new device.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" fullWidth onClick={downloadBackup}>
              Download Backup
            </Button>
            <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-bold text-foreground">
              <Upload className="h-4 w-4" />
              Restore from Backup
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={restoreBackup}
              />
            </label>
          </div>
          {backupMessage && (
            <p className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
              {backupMessage}
            </p>
          )}
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
                Full fresh start: clears board, subjects, exam date, chapters, streak, badges, AI plans, tutor chat, events, reminders, and practice history.
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
                This permanently deletes your saved study data. Download a backup first if you may need it later.
              </p>
              <button
                type="button"
                onClick={downloadBackup}
                className="mt-4 min-h-[44px] w-full rounded-2xl border border-primary/30 bg-primary/5 px-4 text-sm font-bold text-primary"
              >
                Download Backup First
              </button>
              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Type RESET to confirm
                </span>
                <input
                  value={resetConfirmText}
                  onChange={(event) => setResetConfirmText(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="RESET"
                />
              </label>
              <div className="mt-5 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetConfirmText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={confirmResetProgress}
                  disabled={resetConfirmText !== 'RESET'}
                  data-testid="button-confirm-reset-progress"
                >
                  Reset Anyway
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
