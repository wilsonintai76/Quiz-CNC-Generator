'use client';

import { useFirebase } from './FirebaseProvider';
import { Button } from './ui/button';
import { LogOut, AlertCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isActive } = useFirebase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user && !isActive) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Deactivated</h1>
          <p className="text-slate-600 mb-8">
            Your account has been deactivated by an administrator. Please contact support if you believe this is an error.
          </p>
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => signOut(auth)}
          >
            <LogOut size={18} /> Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
