import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuthContext } from '@/context/AuthContext';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export default function Portal() {
  const { signInWithGoogle, continueAsGuest } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in unavailable, please continue as guest.');
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="min-h-[100dvh] max-w-[480px] mx-auto bg-background shadow-[0_0_40px_rgba(0,0,0,0.05)]">
      <div className="flex min-h-[100dvh] flex-col justify-center px-5 py-10">
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
              }}
              data-testid="button-continue-guest"
            >
              Continue as Guest
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
