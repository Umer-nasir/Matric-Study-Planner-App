import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { SYLLABUS_DATA } from '@/data/syllabusData';
import { todayDateOnly } from '@/lib/dateOnly';
import { chapterDisplayName, subjectDisplayName } from '@/lib/subjectLanguage';

export function ReminderManager() {
  const {
    profile,
    aiSchedule,
    chapterCompletion,
    practiceHistory,
    reminderSettings,
    markReminderShown,
  } = useAppContext();
  const [tick, setTick] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const notifiedDate = useRef<string | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const serviceWorkerUrl = `${import.meta.env.BASE_URL}reminder-sw.js`;
      navigator.serviceWorker.register(serviceWorkerUrl).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const nextTask = useMemo(() => {
    if (!profile) return null;
    const today = todayDateOnly();
    const scheduled = aiSchedule?.week
      .find((day) => day.date === today)
      ?.blocks.find((block) => !chapterCompletion[block.subject]?.[block.chapter]?.done);
    if (scheduled) return scheduled;

    for (const subject of profile.subjects) {
      const chapter = (SYLLABUS_DATA[subject] ?? []).find((item) => {
        const state = chapterCompletion[subject]?.[item];
        return !state?.done && state?.selectedForSchedule !== false;
      });
      if (chapter) return { subject, chapter };
    }
    return null;
  }, [aiSchedule, chapterCompletion, profile]);

  const weakChapter = useMemo(() => {
    const latestByChapter = new Map<string, typeof practiceHistory[number]>();
    for (const attempt of practiceHistory) {
      const key = `${attempt.subject}::${attempt.chapter}`;
      const current = latestByChapter.get(key);
      if (!current || new Date(attempt.date).getTime() > new Date(current.date).getTime()) {
        latestByChapter.set(key, attempt);
      }
    }
    return [...latestByChapter.values()].find(
      (attempt) => !attempt.unscored && attempt.total > 0 && attempt.score / attempt.total < 0.6,
    ) ?? null;
  }, [practiceHistory]);

  useEffect(() => {
    if (!profile || !reminderSettings.enabled || !/^\d{2}:\d{2}$/.test(reminderSettings.time)) {
      setMessage(null);
      return;
    }
    const [hour, minute] = reminderSettings.time.split(':').map(Number);
    if (hour > 23 || minute > 59) return;
    const now = new Date();
    const today = todayDateOnly(now);
    const isDue = now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);
    if (!isDue || reminderSettings.lastShownDate === today || notifiedDate.current === today) return;

    const reminderMessage = weakChapter
      ? `Revision reminder: ${subjectDisplayName(weakChapter.subject)} - ${chapterDisplayName(weakChapter.subject, weakChapter.chapter)} needs another try.`
      : nextTask
      ? `Study reminder: ${subjectDisplayName(nextTask.subject)} - ${chapterDisplayName(nextTask.subject, nextTask.chapter)}.`
      : 'Study reminder: open your planner and complete one focused task.';

    notifiedDate.current = today;
    setMessage(reminderMessage);
    markReminderShown(today);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.ready
          .then((registration) => registration.showNotification('Matric Study Planner', { body: reminderMessage }))
          .catch(() => new Notification('Matric Study Planner', { body: reminderMessage }));
      } else {
        new Notification('Matric Study Planner', { body: reminderMessage });
      }
    }
  }, [markReminderShown, nextTask, profile, reminderSettings, tick, weakChapter]);

  if (!message) return null;
  return (
    <div className="fixed inset-x-4 bottom-24 z-[80] mx-auto flex max-w-[440px] items-start gap-3 rounded-2xl border border-primary/20 bg-card p-4 shadow-xl">
      <Bell className="mt-0.5 shrink-0 text-primary" size={18} />
      <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{message}</p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        aria-label="Dismiss reminder"
      >
        <X size={16} />
      </button>
    </div>
  );
}
