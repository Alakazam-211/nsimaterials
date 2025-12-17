'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';

export default function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { login, createAccount, loginWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password match for sign up
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    // Validate password length
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        await createAccount(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      console.error(isSignUp ? 'Sign up error:' : 'Login error:', err);
      const errorMessage = err?.message || err?.code || (isSignUp ? 'Failed to create account.' : 'Failed to sign in. Please check your credentials.');
      
      // Provide more helpful error messages
      if (errorMessage.includes('auth/invalid-credential') || errorMessage.includes('auth/user-not-found') || errorMessage.includes('auth/wrong-password')) {
        setError('Invalid email or password. Please try again.');
      } else if (errorMessage.includes('auth/email-already-in-use')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (errorMessage.includes('auth/weak-password')) {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (errorMessage.includes('auth/invalid-email')) {
        setError('Invalid email address. Please check and try again.');
      } else if (errorMessage.includes('auth/network-request-failed')) {
        setError('Network error. Please check your internet connection.');
      } else if (errorMessage.includes('Firebase auth is not initialized')) {
        setError('Firebase is not configured. Please check your environment variables.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      // Always use popup by default - better UX and no redirect issues
      // Only use redirect if popup is explicitly blocked
      await loginWithGoogle(false);
      // After successful sign-in, the popup will close automatically
      // and the auth state will update via onAuthStateChanged in AuthContext
      // The ProtectedRoute component will automatically redirect to the main app
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const errorMessage = err?.message || err?.code || 'Failed to sign in with Google.';
      
      // If popup is blocked, show helpful message instead of auto-fallback
      // Redirect method causes the stuck page issue, so we avoid it
      if (err?.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again. (Redirect method is disabled to prevent getting stuck on Firebase pages)');
        setIsGoogleLoading(false);
        return;
      }
      
      if (errorMessage.includes('auth/popup-closed-by-user')) {
        setError('Sign-in popup was closed. Please try again.');
      } else if (errorMessage.includes('auth/network-request-failed')) {
        setError('Network error. Please check your internet connection.');
      } else if (errorMessage.includes('auth/cancelled-popup-request')) {
        setError('Another sign-in request is already in progress. Please wait.');
      } else if (errorMessage.includes('Firebase auth is not initialized')) {
        setError('Firebase is not configured. Please check your environment variables.');
      } else {
        setError(errorMessage);
      }
      setIsGoogleLoading(false);
    }
    // Note: We don't set loading to false on success because the component
    // will unmount when the user is authenticated and ProtectedRoute redirects
  };

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/NSI-Logo.png" 
              alt="NSI Logo" 
              className="h-24 w-auto object-contain brightness-0 invert"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Order Submission
          </h1>
          <p className="text-white/90 text-lg">
            {isSignUp ? 'Create an account to get started' : 'Please sign in to continue'}
          </p>
        </div>

        <GlassCard className="p-8 space-y-6">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Google Sign-In Button */}
          <GlassButton
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 !border-white !text-white hover:!bg-white/10 hover:!border-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}
          </GlassButton>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--glass-black-dark)]/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 backdrop-blur-sm text-white font-medium">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-semibold mb-2 text-white"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                placeholder="your.email@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-semibold mb-2 text-white"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                placeholder={isSignUp ? "Choose a password (min. 6 characters)" : "Enter your password"}
                disabled={isLoading}
              />
            </div>

            {isSignUp && (
              <div>
                <label 
                  htmlFor="confirmPassword" 
                  className="block text-sm font-semibold mb-2 text-[var(--glass-black-dark)]"
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
              </div>
            )}

            <GlassButton
              type="submit"
              variant="primary"
              disabled={isLoading || isGoogleLoading}
              className="w-full"
            >
              {isLoading 
                ? (isSignUp ? 'Creating account...' : 'Signing in...') 
                : (isSignUp ? 'Create Account' : 'Sign In')
              }
            </GlassButton>
          </form>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
              className="text-[var(--glass-black-dark)] hover:text-white font-medium text-sm transition-colors"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Create one"
              }
            </button>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

