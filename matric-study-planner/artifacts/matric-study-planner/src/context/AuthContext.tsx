import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Unsubscribe, User } from 'firebase/auth';
import { getFirebaseServices } from '@/lib/firebase';

const AUTH_GUEST_KEY = 'matric_auth_guest';
const AUTH_USER_KEY = 'matric_auth_user';

export interface AuthUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isGuest: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    name: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function getFirebaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
}

function googleSignInErrorMessage(code: string): string {
  if (code.includes('unauthorized-domain')) {
    return 'Google sign-in is blocked because this domain is not authorized in Firebase. Add this Vercel domain in Firebase Auth settings.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'Google sign-in is not enabled in Firebase yet. Enable Google as a sign-in provider.';
  }
  if (code.includes('invalid-api-key') || code.includes('api-key-not-valid')) {
    return 'Google sign-in is not configured correctly. Check the Firebase environment variables in Vercel.';
  }
  return 'Google sign-in unavailable right now. Please continue as guest.';
}

function shouldUseRedirectSignIn(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 768px)').matches ?? false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => loadStoredUser());
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(AUTH_GUEST_KEY) === 'true');
  const [loading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: Unsubscribe | undefined;

    void getFirebaseServices()
      .then(async (services) => {
        if (!services || cancelled) return;
        const { getRedirectResult, onAuthStateChanged } = await import('firebase/auth');
        if (cancelled) return;

        getRedirectResult(services.auth)
          .then((result) => {
            if (!result || cancelled) return;
            const authUser = toAuthUser(result.user);
            setCurrentUser(authUser);
            setIsGuest(false);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
            localStorage.removeItem(AUTH_GUEST_KEY);
          })
          .catch(() => undefined);

        unsubscribe = onAuthStateChanged(services.auth, (user) => {
          if (user) {
            const authUser = toAuthUser(user);
            setCurrentUser(authUser);
            setIsGuest(false);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
            localStorage.removeItem(AUTH_GUEST_KEY);
          } else if (!localStorage.getItem(AUTH_GUEST_KEY)) {
            setCurrentUser(null);
            localStorage.removeItem(AUTH_USER_KEY);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const services = await getFirebaseServices();
    if (!services) {
      throw new Error('Google sign-in unavailable, please continue as guest.');
    }

    try {
      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth');
      if (shouldUseRedirectSignIn()) {
        await signInWithRedirect(services.auth, services.provider);
        return;
      }

      const result = await signInWithPopup(services.auth, services.provider);
      const authUser = toAuthUser(result.user);
      setCurrentUser(authUser);
      setIsGuest(false);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
      localStorage.removeItem(AUTH_GUEST_KEY);
    } catch (error) {
      const code = getFirebaseErrorCode(error);
      if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
        throw new Error('Google sign-in was cancelled. You can try again or continue as guest.');
      }
      if (code.includes('popup-blocked') || code.includes('operation-not-supported-in-this-environment')) {
        const { signInWithRedirect } = await import('firebase/auth');
        await signInWithRedirect(services.auth, services.provider);
        return;
      }
      throw new Error(googleSignInErrorMessage(code));
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    // Intentional hackathon scope: auth personalizes entry only; study data remains localStorage-only for both Google and Guest users.
    setIsGuest(true);
    setCurrentUser(null);
    localStorage.setItem(AUTH_GUEST_KEY, 'true');
    localStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const signOut = useCallback(async () => {
    const services = await getFirebaseServices();
    if (services) {
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      await firebaseSignOut(services.auth).catch(() => undefined);
    }
    setCurrentUser(null);
    setIsGuest(false);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_GUEST_KEY);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isGuest,
      loading,
      signInWithGoogle,
      continueAsGuest,
      signOut,
    }),
    [currentUser, isGuest, loading, signInWithGoogle, continueAsGuest, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
