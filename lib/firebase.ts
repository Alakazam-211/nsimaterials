import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'montimber-vendor-invoic-0tkxoy.firebaseapp.com',
  projectId: 'montimber-vendor-invoic-0tkxoy',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'montimber-vendor-invoic-0tkxoy.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Get the current origin for redirect URLs
const getRedirectUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3002';
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let auth: Auth | undefined;

if (typeof window !== 'undefined') {
  // Only initialize on client side
  try {
    if (getApps().length === 0) {
      // Validate required config
      if (!firebaseConfig.apiKey) {
        console.warn('Firebase API key is missing. Please set NEXT_PUBLIC_FIREBASE_API_KEY in your .env.local file.');
      } else {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
      }
    } else {
      app = getApps()[0];
      auth = getAuth(app);
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export { auth };
export default app;
