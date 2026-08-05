import type { FirebaseApp } from 'firebase/app';
import type { Auth, GoogleAuthProvider } from 'firebase/auth';

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  provider: GoogleAuthProvider;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim().length > 0,
);

let services: FirebaseServices | null = null;

export async function getFirebaseServices(): Promise<FirebaseServices | null> {
  if (!isFirebaseConfigured) return null;
  if (services) return services;

  const [{ initializeApp }, { getAuth, GoogleAuthProvider }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  services = { app, auth, provider };
  return services;
}
