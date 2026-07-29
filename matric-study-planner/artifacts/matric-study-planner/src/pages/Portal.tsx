import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
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
    <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background shadow-[0_0_40px_rgba(0,0,0,0.05)]">
      <div className="flex min-h-[100dvh] flex-col justify-center px-5 py-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="space-y-6"
        >
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <BookOpenCheck size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              Matric Study Planner
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Plan smarter. Study better.
            </p>
          </div>

          <Card className="p-5 space-y-3" noTap>
            <Button
              fullWidth
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
              className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] shadow-sm transition-colors hover:bg-[#f8fafd] disabled:opacity-60"
              data-testid="button-google-sign-in"
            >
              {isSigningIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
              {isSigningIn ? 'Opening Google...' : 'Continue with Google'}
            </button>

            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setError(null);
                continueAsGuest();
                loadDemoData();
              }}
              data-testid="button-load-demo-data"
            >
              Load Demo Data
            </Button>

            {error && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold leading-relaxed text-amber-800">
                {error}
              </p>
            )}
          </Card>

          <p className="px-4 text-center text-xs leading-relaxed text-muted-foreground">
            Guest mode keeps your study data on this device. Google sign-in personalizes your
            account and prepares cloud sync for later.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
