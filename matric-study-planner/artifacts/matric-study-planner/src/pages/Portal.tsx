import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useAuthContext } from '@/context/AuthContext';

const AUTH_REDIRECT_ERROR_KEY = 'matric_auth_redirect_error';
const AUTH_REDIRECT_PENDING_KEY = 'matric_auth_redirect_pending';
const AUTH_REDIRECT_AUTO_RELOAD_KEY = 'matric_auth_redirect_auto_reloaded';
const GOOGLE_OPEN_TIMEOUT_MS = 15000;

export default function Portal() {
  const { signInWithGoogle, continueAsGuest } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const redirectError = localStorage.getItem(AUTH_REDIRECT_ERROR_KEY);
    if (redirectError) {
      setError(redirectError);
      localStorage.removeItem(AUTH_REDIRECT_ERROR_KEY);
    }

    const pendingStartedAt = Number(localStorage.getItem(AUTH_REDIRECT_PENDING_KEY) ?? 0);
    if (pendingStartedAt && Date.now() - pendingStartedAt > GOOGLE_OPEN_TIMEOUT_MS) {
      localStorage.removeItem(AUTH_REDIRECT_PENDING_KEY);
      if (sessionStorage.getItem(AUTH_REDIRECT_AUTO_RELOAD_KEY) !== 'true') {
        sessionStorage.setItem(AUTH_REDIRECT_AUTO_RELOAD_KEY, 'true');
        window.setTimeout(() => window.location.reload(), 500);
        return;
      }
      setError('Google sign-in did not finish. Please try again, or continue as guest for now.');
    }
  }, []);

  async function handleGoogleSignIn() {
    setError(null);
    sessionStorage.removeItem(AUTH_REDIRECT_AUTO_RELOAD_KEY);
    setIsSigningIn(true);
    try {
      await Promise.race([
        signInWithGoogle(),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error('Google sign-in is taking too long. Please try again, or continue as guest.')),
            GOOGLE_OPEN_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in unavailable, please continue as guest.');
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="app-shell overflow-hidden">
      <div className="ambient-orb -right-20 top-20 h-52 w-52 bg-primary/10" />
      <div className="ambient-orb -left-28 top-[44%] h-60 w-60 bg-emerald-300/10" />
      <div className="flex min-h-[100dvh] flex-col px-5 pb-7 pt-7 sm:px-7">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="flex flex-1 flex-col"
        >
          <header className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] bg-[linear-gradient(145deg,#8275ff,#5840db)] text-primary-foreground shadow-[0_12px_28px_rgba(91,66,220,0.3),inset_0_1px_0_rgba(255,255,255,0.35)]">
                <BookOpenCheck size={25} />
              </div>
              <div>
                <p className="eyebrow">
                  Matric
                </p>
                <h1 className="font-display text-lg font-extrabold leading-tight text-foreground">
                  Study Planner
                </h1>
              </div>
            </div>
            <div className="glass-surface rounded-2xl px-3.5 py-2 text-right shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Exam Focus
              </p>
              <p className="text-sm font-black text-foreground">Grade 9-10</p>
            </div>
          </header>

          <main className="relative z-10 flex flex-1 flex-col justify-center py-7">
            <section className="mb-6">
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 280, damping: 26 }}
                className="premium-hero overflow-hidden rounded-[2rem] border border-white/15"
              >
                <div className="border-b border-white/10 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/60">
                        Your study command center
                      </p>
                      <h2 className="font-display mt-1 text-2xl font-extrabold text-white">
                        3 focused blocks
                      </h2>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-200 backdrop-blur-sm">
                      <Sparkles size={21} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  {[
                    {
                      icon: CalendarDays,
                      title: 'Physics revision',
                      meta: 'Current Electricity',
                      tone: 'bg-primary/10 text-primary',
                    },
                    {
                      icon: Target,
                      title: 'Practice set',
                      meta: 'Board-style MCQs',
                      tone: 'bg-emerald-50 text-emerald-700',
                    },
                    {
                      icon: Clock3,
                      title: 'Quick review',
                      meta: '20 minutes',
                      tone: 'bg-amber-50 text-amber-700',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.075] px-3 py-3 backdrop-blur-sm"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-white">{item.title}</p>
                          <p className="truncate text-xs font-medium text-white/55">{item.meta}</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </section>

            <section className="mb-5 text-center">
              <div className="eyebrow mb-3 justify-center">
                <Zap size={12} fill="currentColor" /> Built for board exams
              </div>
              <h2 className="font-display text-[2.4rem] font-extrabold leading-[1.04] text-foreground">
                Study smarter.<br />Arrive ready.
              </h2>
              <p className="mx-auto mt-3 max-w-[330px] text-sm leading-relaxed text-muted-foreground">
                Build an exam-ready routine with chapter plans, AI help, practice, and progress in one calm workspace.
              </p>
            </section>

            <section
              className="glass-surface rounded-[1.75rem] p-4"
              aria-label="Sign in options"
            >
              <div className="space-y-3">
                <Button
                  fullWidth
                  className="h-[52px] text-[15px]"
                  onClick={() => {
                    setError(null);
                    continueAsGuest();
                  }}
                  data-testid="button-continue-guest"
                >
                  Continue as Guest
                </Button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-[#dedee8] bg-white px-4 text-sm font-bold text-[#3c4043] shadow-[0_5px_16px_rgba(36,32,64,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60"
                  data-testid="button-google-sign-in"
                >
                  {isSigningIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                  {isSigningIn ? 'Opening Google...' : 'Continue with Google'}
                </button>

              </div>

              {error && (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold leading-relaxed text-amber-800">
                  {error}
                </p>
              )}
            </section>
          </main>

          <p className="px-3 text-center text-xs leading-relaxed text-muted-foreground">
            Guest mode keeps your study data on this device. Google sign-in personalizes your
            account and prepares cloud sync for later.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
