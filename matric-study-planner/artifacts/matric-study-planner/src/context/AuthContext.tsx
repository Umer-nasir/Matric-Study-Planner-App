import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => loadStoredUser());
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(AUTH_GUEST_KEY) === 'true');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const services = getFirebaseServices();
    if (!services) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(services.auth, (user) => {
      if (user) {
        const authUser = toAuthUser(user);
        setCurrentUser(authUser);
        setIsGuest(false);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
        localStorage.removeItem(AUTH_GUEST_KEY);
      } else {
        setCurrentUser(null);
        localStorage.removeItem(AUTH_USER_KEY);
      }
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const services = getFirebaseServices();
    if (!services) {
      throw new Error('Google sign-in unavailable, please continue as guest.');
    }

    try {
      const result = await signInWithPopup(services.auth, services.provider);
      const authUser = toAuthUser(result.user);
      setCurrentUser(authUser);
      setIsGuest(false);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
      localStorage.removeItem(AUTH_GUEST_KEY);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
        throw new Error('Google sign-in was cancelled. You can try again or continue as guest.');
      }
      throw new Error('Google sign-in unavailable right now. Please continue as guest.');
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
    const services = getFirebaseServices();
    if (services) {
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
