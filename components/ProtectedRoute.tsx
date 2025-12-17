'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from './LoginForm';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, hasAccess, checkingAccess, logout } = useAuth();

  // Debug: Log auth state changes
  useEffect(() => {
    if (user) {
      console.log('User authenticated:', user.email);
    } else if (!loading) {
      console.log('User not authenticated');
    }
  }, [user, loading]);

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading || checkingAccess || (user && hasAccess === null)) {
    return (
      <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // Check if user has access
  if (hasAccess === false) {
    return (
      <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <GlassCard className="p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">
                Access Denied
              </h2>
              <p className="text-white/90 mb-6">
                You do not have access to this app. Please contact an Admin.
              </p>
              <GlassButton
                type="button"
                variant="primary"
                onClick={handleSignOut}
                className="w-full"
              >
                Return to Login
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </main>
    );
  }

  // User has access (hasAccess === true)
  return <>{children}</>;
}
