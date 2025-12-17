'use client';

import OrderSubmissionForm from '@/components/OrderSubmissionForm';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import GlassButton from '@/components/GlassButton';
import Image from 'next/image';

function HomeContent() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with Logo, Title, and Logout */}
        <div className="flex items-center justify-between mb-8">
          {/* Logo on the left */}
          <div className="flex-shrink-0">
            <Image
              src="/NSI-Logo.png"
              alt="NSI Logo"
              width={120}
              height={60}
              className="h-12 w-auto brightness-0 invert"
              priority
            />
          </div>
          
          {/* Centered Title and Subtitle */}
          <div className="flex-1 text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Order Submission
            </h1>
            <p className="text-white/90 text-lg">
              Submit your order details and line items
            </p>
          </div>
          
          {/* Logout on the right */}
          <div className="flex-shrink-0 ml-4">
            <div className="text-right mb-2">
              <p className="text-white/80 text-sm">
                {user?.email}
              </p>
            </div>
            <GlassButton
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="text-sm border-white/50 text-white hover:border-white hover:text-white"
            >
              Sign Out
            </GlassButton>
          </div>
        </div>
        <OrderSubmissionForm />
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <ProtectedRoute>
      <HomeContent />
    </ProtectedRoute>
  );
}


