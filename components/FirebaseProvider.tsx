'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  fullName?: string;
  registrationNo?: string;
  class?: string;
  role: 'admin' | 'student';
  isActive: boolean;
  createdAt: any;
}

interface FirebaseContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isOnboarded: boolean;
  isActive: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isOnboarded: false,
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Cleanup previous profile listener if any
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen to user profile
        unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const email = firebaseUser.email || '';
            const isAdminEmail = email === 'wilsonintai76@gmail.com' || email === 'wilson@poliku.edu.my';
            
            // Auto-upgrade to admin if email matches but role is student
            if (isAdminEmail && data.role !== 'admin') {
              updateDoc(userDocRef, { role: 'admin' }).catch(console.error);
            }
            
            setProfile(data);
          } else {
            // Create profile if it doesn't exist
            const email = firebaseUser.email || '';
            const isAdminEmail = email === 'wilsonintai76@gmail.com' || email === 'wilson@poliku.edu.my';
            
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: email,
              displayName: firebaseUser.displayName || 'User',
              fullName: firebaseUser.displayName || '', // Auto-fetch name from Google
              role: isAdminEmail ? 'admin' : 'student',
              isActive: true,
              createdAt: serverTimestamp(),
            };
            
            setDoc(userDocRef, newProfile).catch(err => {
              handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
            });
          }
          setLoading(false);
        }, (error) => {
          // Only log error if user is still logged in
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isOnboarded: !!(profile?.fullName && profile?.registrationNo && profile?.class) || profile?.role === 'admin',
    isActive: profile?.isActive !== false,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}
