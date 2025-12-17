import type { Metadata } from 'next';
import '../styles/glassmorphic.css';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import AuthRedirectHandler from '@/components/AuthRedirectHandler';

export const metadata: Metadata = {
  title: 'NSI Order Submission',
  description: 'Submit orders to QuickBase',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthRedirectHandler />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}


