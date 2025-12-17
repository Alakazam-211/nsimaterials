'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasAccess: boolean | null; // null = not checked yet, true = has access, false = no access
  checkingAccess: boolean;
  login: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (useRedirect?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkUserAccess: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);

  const checkUserAccess = useCallback(async (email: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/check-user-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        console.error('Failed to check user access:', await response.text());
        return false;
      }

      const data = await response.json();
      return data.hasAccess === true;
    } catch (error) {
      console.error('Error checking user access:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      console.error('Firebase auth is not initialized. Please check your environment variables.');
      console.error('Required environment variables:');
      console.error('- NEXT_PUBLIC_FIREBASE_API_KEY');
      console.error('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
      console.error('- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
      console.error('- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
      console.error('- NEXT_PUBLIC_FIREBASE_APP_ID');
      // Set loading to false so the app can render (will show login form)
      setLoading(false);
      return;
    }

    // Check for redirect result (for signInWithRedirect)
    // This handles the case where user was redirected back from Google sign-in
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('Redirect sign-in successful:', result.user.email);
          // The auth state will be updated by onAuthStateChanged below
        }
      })
      .catch((error) => {
        // Ignore redirect errors if no redirect was initiated
        if (!error.message?.includes('auth/no-auth-event') && !error.message?.includes('auth/argument-error')) {
          console.error('Redirect result error:', error);
        }
      });

    try {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
        setUser(user);
        
        if (user && user.email) {
          // Check user access when they log in
          setCheckingAccess(true);
          try {
            const access = await checkUserAccess(user.email);
            setHasAccess(access);
          } catch (error) {
            console.error('Error checking user access:', error);
            setHasAccess(false);
          } finally {
            setCheckingAccess(false);
            setLoading(false);
          }
        } else {
          // User logged out, reset access
          setHasAccess(null);
          setLoading(false);
        }
      }, (error) => {
        console.error('Firebase auth state change error:', error);
        setLoading(false);
        setHasAccess(null);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up auth state listener:', error);
      setLoading(false);
      setHasAccess(null);
    }
  }, [checkUserAccess]);

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized. Please check your environment variables.');
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const createAccount = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized. Please check your environment variables.');
    }
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async (useRedirect: boolean = false) => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized. Please check your environment variables.');
    }
    const provider = new GoogleAuthProvider();
    // Add custom parameters for better redirect handling
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    try {
      if (useRedirect) {
        // Use redirect - Firebase will redirect back to the current origin
        // Make sure authorized domains are configured in Firebase Console
        await signInWithRedirect(auth, provider);
        // Note: With redirect, Firebase will redirect to its handler page,
        // then back to the app. The getRedirectResult will handle it.
        // The auth state will update via onAuthStateChanged listener
      } else {
        // Use popup - better UX, no redirect issues, recommended method
        const result = await signInWithPopup(auth, provider);
        // The popup will close automatically after successful sign-in
        // The auth state will update via onAuthStateChanged listener
        return result;
      }
    } catch (error: any) {
      // Re-throw the error so it can be handled by the component
      throw error;
    }
  };

  const logout = async () => {
    if (!auth) {
      throw new Error('Firebase auth is not initialized. Please check your environment variables.');
    }
    await signOut(auth);
    // Reset access when logging out
    setHasAccess(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      hasAccess, 
      checkingAccess,
      login, 
      createAccount, 
      loginWithGoogle, 
      logout,
      checkUserAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
