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
} from 'lucide-react';
import { Button } from '@/components/Button';
import { GoogleIcon } from '@/components/GoogleIcon';
import { useAuthContext } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';

const AUTH_REDIRECT_ERROR_KEY = 'matric_auth_redirect_error';
const AUTH_REDIRECT_PENDING_KEY = 'matric_auth_redirect_pending';
const AUTH_REDIRECT_AUTO_RELOAD_KEY = 'matric_auth_redirect_auto_reloaded';
const GOOGLE_OPEN_TIMEOUT_MS = 15000;

export default function Portal() {
  const { signInWithGoogle, continueAsGuest } = useAuthContext();
  const { loadDemoData } = useAppContext();
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
    <div className="min-h-[100dvh] max-w-[480px] mx-auto overflow-hidden bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--accent))_48%,hsl(var(--background))_100%)] shadow-[0_0_40px_rgba(0,0,0,0.05)]">
      <div className="flex min-h-[100dvh] flex-col px-5 pb-7 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="flex flex-1 flex-col"
        >
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <BookOpenCheck size={25} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-primary">
                  Matric
                </p>
                <h1 className="text-lg font-black leading-tight text-foreground">
                  Study Planner
                </h1>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-card/80 px-3 py-2 text-right shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Exam Focus
              </p>
              <p className="text-sm font-black text-foreground">Grade 9-10</p>
            </div>
          </header>

          <main className="flex flex-1 flex-col justify-center py-7">
            <section className="mb-6">
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.08, type: 'spring', stiffness: 280, damping: 26 }}
                className="overflow-hidden rounded-[2rem] border border-card-border bg-card shadow-xl shadow-primary/10"
              >
                <div className="border-b border-border bg-background/80 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-primary">
                        Today
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">
                        3 focused blocks
                      </h2>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
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
                        className="flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-foreground">{item.title}</p>
                          <p className="truncate text-xs font-medium text-muted-foreground">{item.meta}</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </section>

            <section className="mb-5 text-center">
              <h2 className="text-4xl font-black tracking-tight text-foreground">
                Study with a plan that keeps up.
              </h2>
              <p className="mx-auto mt-3 max-w-[330px] text-sm leading-relaxed text-muted-foreground">
                Build an exam-ready routine with chapter plans, AI help, practice, and progress in one calm workspace.
              </p>
            </section>

            <section
              className="rounded-[1.75rem] border border-card-border bg-card/95 p-4 shadow-xl shadow-black/5"
              aria-label="Sign in options"
            >
              <div className="space-y-3">
                <Button
                  fullWidth
                  className="h-12"
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
                  className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl border border-[#dadce0] bg-white px-4 text-sm font-bold text-[#3c4043] shadow-sm transition-colors hover:bg-[#f8fafd] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60"
                  data-testid="button-google-sign-in"
                >
                  {isSigningIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
                  {isSigningIn ? 'Opening Google...' : 'Continue with Google'}
                </button>

                <Button
                  variant="outline"
                  fullWidth
                  className="h-12"
                  onClick={() => {
                    setError(null);
                    continueAsGuest();
                    loadDemoData();
                  }}
                  data-testid="button-load-demo-data"
                >
                  Load Demo Data
                </Button>
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
