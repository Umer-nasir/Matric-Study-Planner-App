import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/Button';
import { BOARDS, SUBJECTS } from '@/data/syllabus';
import { useAppContext } from '@/context/AppContext';
import {
  addDaysDateOnly,
  dateInputValueToExamDate,
  dateOnlyToLocalDate,
  daysUntilDateOnly,
  examDateToLocalDate,
} from '@/lib/dateOnly';
import {
  canChooseSubjectLanguage,
  defaultSubjectLanguage,
  normalizeSubjectLanguages,
  type SubjectStudyLanguage,
} from '@/lib/subjectLanguage';

const stepVariants = {
  enter: { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
};

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [selectedBoard, setSelectedBoard] = useState('');
  const [boardConfirmed, setBoardConfirmed] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSubjectLanguages, setSelectedSubjectLanguages] = useState<Record<string, SubjectStudyLanguage>>({});
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

    if (step === 4) {
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

      setProfile({
        board: selectedBoard,
        subjects: selectedSubjects,
        subjectLanguages: normalizeSubjectLanguages(selectedSubjects, selectedSubjectLanguages),
        examDate: dateInputValueToExamDate(examDate),
        onboardingComplete: true,
      });
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
      setSelectedSubjectLanguages((current) => {
        const next = { ...current };
        delete next[subject];
        return next;
      });
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
      setSelectedSubjectLanguages((current) => ({
        ...current,
        [subject]: current[subject] ?? defaultSubjectLanguage(subject),
      }));
    }
  };

  const setSubjectLanguage = (subject: string, language: SubjectStudyLanguage) => {
    setSelectedSubjectLanguages((current) => ({
      ...current,
      [subject]: language,
    }));
  };

  const languageChoiceSubjects = selectedSubjects.filter(canChooseSubjectLanguage);

  const daysUntilExam =
    examDate
      ? daysUntilDateOnly(examDate)
      : null;
  const minExamDate = addDaysDateOnly(1);
  const formattedExamDate = examDate
    ? examDateToLocalDate(examDate).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background flex flex-col relative shadow-[0_0_40px_rgba(0,0,0,0.05)]">

      {/* Progress Dots */}
      <div className="pt-12 pb-6 px-6 flex justify-center space-x-2">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            animate={{
              width: i === step ? 32 : 8,
              backgroundColor: i <= step ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
              opacity: i < step ? 0.45 : 1,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="h-2 rounded-full"
            style={{ width: i === step ? 32 : 8 }}
          />
        ))}
      </div>

      <div className="flex-1 px-6 relative overflow-hidden flex flex-col">
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
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">
                Which board are you in?
              </h1>

              <div className="space-y-3 flex-1 overflow-y-auto pb-24">
                {BOARDS.map((board) => (
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
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center justify-between ${
                      selectedBoard === board
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-transparent bg-card shadow-sm hover:border-primary/20'
                    }`}
                  >
                    <span className="font-medium text-lg">{board}</span>
                    <motion.div
                      animate={
                        selectedBoard === board
                          ? { scale: [1, 1.25, 1], borderColor: 'hsl(var(--primary))' }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.25 }}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
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
                            className="w-3 h-3 rounded-full bg-primary"
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.button>
                ))}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
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
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                Which subjects are you studying?
              </h1>
              <p className="text-muted-foreground mb-6">Select at least 3 subjects.</p>

              <div className="space-y-3 flex-1 overflow-y-auto pb-24">
                {SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjects.includes(subject);
                  return (
                    <motion.button
                      key={subject}
                      onClick={() => toggleSubject(subject)}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      data-testid={`subject-select-${subject.replace(/\s+/g, '-').toLowerCase()}`}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-transparent bg-card shadow-sm hover:border-primary/20'
                      }`}
                    >
                      <span className="font-medium text-lg">{subject}</span>
                      <motion.div
                        animate={
                          isSelected
                            ? { scale: [1, 1.2, 1], backgroundColor: 'hsl(var(--primary))' }
                            : { scale: 1, backgroundColor: 'transparent' }
                        }
                        transition={{ duration: 0.22 }}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
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
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                Choose study language
              </h1>
              <p className="text-muted-foreground mb-6">
                For each subject, choose how AI explanations and practice answers should be written.
              </p>

              <div className="space-y-3 flex-1 overflow-y-auto pb-24">
                {languageChoiceSubjects.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-5 text-sm font-semibold text-muted-foreground">
                    English and Urdu use their own fixed language automatically.
                  </div>
                ) : (
                  languageChoiceSubjects.map((subject) => {
                    const language = selectedSubjectLanguages[subject] ?? defaultSubjectLanguage(subject);
                    return (
                      <div
                        key={subject}
                        className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <p className="mb-3 text-base font-bold text-foreground">{subject}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(['english', 'urdu'] as const).map((option) => {
                            const selected = language === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setSubjectLanguage(subject, option)}
                                className={`min-h-[44px] rounded-2xl border px-3 text-sm font-bold transition-colors ${
                                  selected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-background text-muted-foreground'
                                }`}
                                data-testid={`subject-language-${subject.replace(/\s+/g, '-').toLowerCase()}-${option}`}
                              >
                                {option === 'english' ? 'English' : 'Urdu'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">
                When is your exam?
              </h1>

              <div className="flex-1">
                <label className="mb-3 block text-sm font-semibold text-muted-foreground">
                  Exam date
                </label>
                <div className="relative mb-6">
                  <input
                    type="date"
                    value={examDate}
                    min={minExamDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    data-testid="input-exam-date"
                    aria-label="Exam date"
                    className="h-[74px] w-full cursor-pointer rounded-2xl border border-input bg-card px-5 text-transparent shadow-sm caret-transparent outline-none transition-colors focus:ring-2 focus:ring-primary"
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
                      className="p-4 bg-accent/30 text-accent-foreground rounded-2xl border border-accent text-center"
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
      <div className="fixed bottom-0 left-0 right-0 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-background via-background to-transparent max-w-[480px] mx-auto">
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
              : step === 4
              ? 'Get Started'
              : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
