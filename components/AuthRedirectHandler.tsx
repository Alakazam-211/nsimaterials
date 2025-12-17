'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Component to handle Firebase auth redirects
 * Processes redirect results when the app loads after a redirect
 */
export default function AuthRedirectHandler() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // This component runs in our app, not on the Firebase handler page
    // It helps process redirect results when we return to the app
    // The actual redirect handling happens in AuthContext's getRedirectResult
  }, [user, loading]);

  return null;
}
