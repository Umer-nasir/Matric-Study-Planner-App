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
const AUTH_REDIRECT_ERROR_KEY = 'matric_auth_redirect_error';
const AUTH_SIGNING_OUT_KEY = 'matric_auth_signing_out';
const AUTH_REDIRECT_PENDING_KEY = 'matric_auth_redirect_pending';

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

function setLocalStorageItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not save ${key} to localStorage.`, error);
  }
}

function removeLocalStorageItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures; auth state in memory is the source of truth for this session.
  }
}

function getFirebaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
}

function googleSignInErrorMessage(code: string): string {
  if (!code) {
    return 'Google sign-in failed, but Firebase did not return a setup code. Check Firebase config and authorized domains.';
  }
  if (code.includes('unauthorized-domain')) {
    return 'Google sign-in is blocked because this domain is not authorized in Firebase. Add this Vercel domain in Firebase Auth settings.';
  }
  if (code.includes('operation-not-allowed') || code.includes('configuration-not-found')) {
    return 'Google sign-in is not enabled in Firebase yet. Enable Google as a sign-in provider.';
  }
  if (code.includes('invalid-api-key') || code.includes('api-key-not-valid')) {
    return 'Google sign-in is not configured correctly. Check the Firebase environment variables in Vercel.';
  }
  if (code.includes('network-request-failed')) {
    return 'Google sign-in could not reach Firebase. Check your internet connection and try again.';
  }
  return `Google sign-in failed (${code}). Please continue as guest for now.`;
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
            removeLocalStorageItem(AUTH_REDIRECT_PENDING_KEY);
            if (!result || cancelled) return;
            const authUser = toAuthUser(result.user);
            setCurrentUser(authUser);
            setIsGuest(false);
            setLocalStorageItem(AUTH_USER_KEY, JSON.stringify(authUser));
            removeLocalStorageItem(AUTH_GUEST_KEY);
          })
          .catch((error) => {
            removeLocalStorageItem(AUTH_REDIRECT_PENDING_KEY);
            setLocalStorageItem(AUTH_REDIRECT_ERROR_KEY, googleSignInErrorMessage(getFirebaseErrorCode(error)));
          });

        unsubscribe = onAuthStateChanged(services.auth, (user) => {
          if (user) {
            if (sessionStorage.getItem(AUTH_SIGNING_OUT_KEY) === 'true') {
              return;
            }
            const authUser = toAuthUser(user);
            setCurrentUser(authUser);
            setIsGuest(false);
            setLocalStorageItem(AUTH_USER_KEY, JSON.stringify(authUser));
            removeLocalStorageItem(AUTH_GUEST_KEY);
          } else if (!localStorage.getItem(AUTH_GUEST_KEY)) {
            setCurrentUser(null);
            removeLocalStorageItem(AUTH_USER_KEY);
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
      throw new Error('Google sign-in is not configured. Add the VITE_FIREBASE_* environment variables in Vercel, then redeploy.');
    }

    try {
      const { signInWithPopup, signInWithRedirect } = await import('firebase/auth');
      removeLocalStorageItem(AUTH_REDIRECT_PENDING_KEY);
      const result = await signInWithPopup(services.auth, services.provider);
      const authUser = toAuthUser(result.user);
      setCurrentUser(authUser);
      setIsGuest(false);
      setLocalStorageItem(AUTH_USER_KEY, JSON.stringify(authUser));
      removeLocalStorageItem(AUTH_GUEST_KEY);
    } catch (error) {
      const code = getFirebaseErrorCode(error);
      if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
        throw new Error('Google sign-in was cancelled. You can try again or continue as guest.');
      }
      if (code.includes('popup-blocked') || code.includes('operation-not-supported-in-this-environment')) {
        const { signInWithRedirect } = await import('firebase/auth');
        setLocalStorageItem(AUTH_REDIRECT_PENDING_KEY, String(Date.now()));
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
    setLocalStorageItem(AUTH_GUEST_KEY, 'true');
    removeLocalStorageItem(AUTH_USER_KEY);
  }, []);

  const signOut = useCallback(async () => {
    sessionStorage.setItem(AUTH_SIGNING_OUT_KEY, 'true');
    setCurrentUser(null);
    setIsGuest(false);
    removeLocalStorageItem(AUTH_USER_KEY);
    removeLocalStorageItem(AUTH_GUEST_KEY);

    const services = await getFirebaseServices();
    if (services) {
      const { signOut: firebaseSignOut } = await import('firebase/auth');
      await firebaseSignOut(services.auth).catch(() => undefined);
    }
    window.setTimeout(() => {
      sessionStorage.removeItem(AUTH_SIGNING_OUT_KEY);
    }, 1500);
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
