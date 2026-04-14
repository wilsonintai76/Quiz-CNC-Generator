'use client';

import Link from 'next/link';
import { useFirebase } from './FirebaseProvider';
import { Button } from './ui/button';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LogOut, User, ShieldCheck, BookOpen, BarChart3 } from 'lucide-react';
import { Badge } from './ui/badge';

export function Navbar() {
  const { user, profile, isAdmin } = useFirebase();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
                <ShieldCheck size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight">CNC Quiz Master</span>
            </Link>

            {user && (
              <div className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                  <BookOpen size={16} />
                  Quizzes
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                    <ShieldCheck size={16} />
                    Admin Panel
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-semibold">{profile?.displayName || user.displayName}</span>
                  <Badge variant={isAdmin ? "default" : "secondary"} className="text-[10px] h-4 px-1 uppercase">
                    {profile?.role || 'Student'}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                  <LogOut size={20} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
