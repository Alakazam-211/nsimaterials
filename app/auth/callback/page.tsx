'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait for auth state to update
    if (!loading) {
      if (user) {
        // User is authenticated, redirect to home
        router.push('/');
      } else {
        // User is not authenticated, redirect to login
        router.push('/');
      }
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="text-white text-xl">Completing sign-in...</div>
    </main>
  );
}
