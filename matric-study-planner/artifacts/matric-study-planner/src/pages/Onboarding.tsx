import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpenCheck, CalendarDays, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/Button';
import { SubjectIcon } from '@/components/SubjectIcon';
import { BOARDS, SUBJECTS } from '@/data/syllabus';
import { useAppContext } from '@/context/AppContext';
import {
  subjectDisplayName,
  subjectNameDirectionClass,
} from '@/lib/subjectLanguage';
import {
  addDaysDateOnly,
  dateInputValueToExamDate,
  dateOnlyToLocalDate,
  daysUntilDateOnly,
  examDateToLocalDate,
} from '@/lib/dateOnly';
import {
  MAX_EXAM_DATE_DAYS,
  createCompletedProfile,
  isValidExamDate,
} from '@/lib/onboardingProfile';

const stepVariants = {
  enter: { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
};

const stepLabels = ['Board', 'Subjects', 'Exam date'];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [selectedBoard, setSelectedBoard] = useState('');
  const [boardConfirmed, setBoardConfirmed] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [examDate, setExamDate] = useState('');
  const [error, setError] = useState('');

  const [, setLocation] = useLocation();
  const { setProfile } = useAppContext();

  const handleNext = () => {
    setError('');

    if (step === 1 && !selectedBoard) {
      setError('Please select a board to continue.');
      return;
    }
    if (step === 1 && !boardConfirmed) {
      setBoardConfirmed(true);
      return;
    }

    if (step === 2 && selectedSubjects.length < 3) {
      setError('Please select at least 3 subjects.');
      return;
    }

    if (step === 3) {
      if (!examDate) {
        setError('Please select your exam date.');
        return;
      }

      const selected = dateOnlyToLocalDate(examDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selected <= today) {
        setError('Exam date must be in the future.');
        return;
      }
      if (!isValidExamDate(examDate)) {
        setError('Please select a valid exam date within the next 3 years.');
        return;
      }

      setProfile(createCompletedProfile({
        board: selectedBoard,
        subjects: selectedSubjects,
        examDate: dateInputValueToExamDate(examDate),
      }));
      setLocation('/dashboard');
      return;
    }

    setDirection(1);
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setError('');
    if (step > 1) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const toggleSubject = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  const daysUntilExam =
    examDate
      ? daysUntilDateOnly(examDate)
      : null;
  const minExamDate = addDaysDateOnly(1);
  const maxExamDate = addDaysDateOnly(MAX_EXAM_DATE_DAYS);
  const formattedExamDate = examDate
    ? examDateToLocalDate(examDate).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="app-shell flex flex-col">
      <div className="ambient-orb -right-20 -top-20 h-64 w-64 bg-primary/10" />
      <div className="ambient-orb -left-24 top-[46%] h-52 w-52 bg-emerald-300/10" />

      <div className="relative z-10 px-5 pb-6 pt-6 sm:px-7">
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
              <BookOpenCheck size={20} />
            </div>
            <div>
              <p className="font-display text-sm font-extrabold leading-none">Study Planner</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Personal setup</p>
            </div>
          </div>
          <div className="rounded-full border border-primary/10 bg-primary/8 px-3 py-1.5 text-[11px] font-extrabold text-primary">
            {step} of 3
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" aria-label={`Step ${step} of 3: ${stepLabels[step - 1]}`}>
          {stepLabels.map((label, index) => {
            const itemStep = index + 1;
            const isActive = itemStep === step;
            const isComplete = itemStep < step;
            return (
              <div key={label} className="min-w-0">
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    initial={false}
                    animate={{ width: itemStep <= step ? '100%' : '0%' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="h-full rounded-full bg-[linear-gradient(90deg,#7667ff,#9c8fff)]"
                  />
                </div>
                <p className={`truncate text-[10px] font-bold ${isActive ? 'text-primary' : isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {isComplete ? 'Done' : label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden px-5 sm:px-7">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="flex-1 flex flex-col"
            >
              <p className="eyebrow mb-3"><Sparkles size={12} /> Shape your study plan</p>
              <h1 className="font-display mb-3 text-[2rem] font-extrabold leading-tight text-foreground">
                Which board are you in?
              </h1>
              <p className="mb-7 text-sm leading-relaxed text-muted-foreground">We’ll tailor every chapter and practice set to your syllabus.</p>

              <div className="scrollbar-none flex-1 space-y-3 overflow-y-auto pb-28">
                {BOARDS.map((board, index) => (
                  <motion.button
                    key={board}
                    onClick={() => {
                      setSelectedBoard(board);
                      setBoardConfirmed(false);
                      setError('');
                    }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    data-testid={`board-select-${board.replace(/\s+/g, '-').toLowerCase()}`}
                    className={`group flex w-full items-center justify-between rounded-[1.35rem] border p-4 text-left transition-all ${
                      selectedBoard === board
                        ? 'border-primary/45 bg-primary/[0.075] shadow-[0_12px_28px_rgba(92,69,220,0.1)]'
                        : 'border-white/80 bg-card/85 shadow-[0_7px_24px_rgba(45,40,80,0.06)] hover:border-primary/20 hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-3.5">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-extrabold ${selectedBoard === board ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="font-bold text-foreground">{board}</span>
                    </span>
                    <motion.div
                      animate={
                        selectedBoard === board
                          ? { scale: [1, 1.25, 1], borderColor: 'hsl(var(--primary))' }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.25 }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                        selectedBoard === board
                          ? 'border-primary'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      <AnimatePresence>
                        {selectedBoard === board && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                            className="flex h-full w-full items-center justify-center rounded-full bg-primary text-white"
                          ><Check size={14} strokeWidth={3} /></motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.button>
                ))}
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs font-semibold leading-relaxed text-amber-900">
                  Choose carefully - this cannot be changed later because it determines your syllabus.
                </div>
                <AnimatePresence>
                  {selectedBoard && boardConfirmed && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-center text-sm font-bold text-primary"
                    >
                      You selected {selectedBoard}. Tap Next to continue.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="flex-1 flex flex-col"
            >
              <p className="eyebrow mb-3"><Sparkles size={12} /> Build your curriculum</p>
              <h1 className="font-display text-[2rem] font-extrabold leading-tight text-foreground">
                Which subjects are you studying?
              </h1>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">Choose at least 3. You can refine chapters later.</p>

              <div className="scrollbar-none flex-1 space-y-3 overflow-y-auto pb-28">
                {SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjects.includes(subject);
                  return (
                    <motion.button
                      key={subject}
                      onClick={() => toggleSubject(subject)}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      data-testid={`subject-select-${subject.replace(/\s+/g, '-').toLowerCase()}`}
                      className={`flex w-full items-center justify-between gap-3 rounded-[1.35rem] border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-primary/45 bg-primary/[0.075] shadow-[0_12px_28px_rgba(92,69,220,0.1)]'
                          : 'border-white/80 bg-card/85 shadow-[0_7px_24px_rgba(45,40,80,0.06)] hover:border-primary/20 hover:bg-white'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSelected ? 'bg-primary/12' : 'bg-secondary'}`}><SubjectIcon subject={subject} className="h-6 w-6 text-xl" /></span>
                        <span className={`truncate font-bold ${subjectNameDirectionClass(subject)}`}>
                          {subjectDisplayName(subject)}
                        </span>
                      </span>
                      <motion.div
                        animate={
                          isSelected
                            ? { scale: [1, 1.2, 1], backgroundColor: 'hsl(var(--primary))' }
                            : { scale: 1, backgroundColor: 'transparent' }
                        }
                        transition={{ duration: 0.22 }}
                        className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'border-primary' : 'border-muted-foreground/30'
                        }`}
                      >
                        <AnimatePresence>
                          {isSelected && (
                            <motion.svg
                              initial={{ scale: 0, rotate: -15 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                              className="w-4 h-4 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </motion.svg>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="flex-1 flex flex-col"
            >
              <p className="eyebrow mb-3"><Sparkles size={12} /> Set your finish line</p>
              <h1 className="font-display text-[2rem] font-extrabold leading-tight text-foreground">
                When is your exam?
              </h1>
              <p className="mb-8 mt-2 text-sm leading-relaxed text-muted-foreground">Your date helps us pace revision without cramming.</p>

              <div className="flex-1">
                <label className="mb-3 block text-sm font-semibold text-muted-foreground">
                  Exam date
                </label>
                <div className="relative mb-6">
                  <input
                    type="date"
                    value={examDate}
                    min={minExamDate}
                    max={maxExamDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    data-testid="input-exam-date"
                    aria-label="Exam date"
                  className="h-[82px] w-full cursor-pointer rounded-[1.4rem] border border-white bg-card/90 px-5 text-transparent shadow-[0_12px_34px_rgba(45,40,80,0.08)] caret-transparent outline-none transition-colors focus:ring-2 focus:ring-primary"
                  />
                  <div className="pointer-events-none absolute left-5 top-1/2 min-w-0 -translate-y-1/2 pr-12">
                    <p className={`text-lg font-bold ${examDate ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {formattedExamDate || 'Select exam date'}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      Tap to open calendar
                    </p>
                  </div>
                  <CalendarDays className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                </div>

                <AnimatePresence>
                  {daysUntilExam !== null && examDate && daysUntilExam > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="rounded-[1.35rem] border border-primary/15 bg-primary/[0.07] p-5 text-center text-accent-foreground"
                    >
                      <p className="font-medium">
                        That is{' '}
                        <span className="font-bold text-xl">{daysUntilExam}</span> days from today!
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-20 mx-auto max-w-[560px] bg-gradient-to-t from-background via-background/95 to-transparent px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-8 backdrop-blur-[2px] sm:px-7">
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="text-destructive text-sm font-medium mb-4 text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex gap-4">
          <AnimatePresence>
            {step > 1 && (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="w-1/3"
              >
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                  data-testid="button-back"
                >
                  Back
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            onClick={handleNext}
            className="flex-1 text-lg shadow-md shadow-primary/20"
            data-testid="button-next"
          >
            {step === 1 && selectedBoard && !boardConfirmed
              ? 'Confirm Board'
              : step === 3
              ? 'Get Started'
              : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
