'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/components/FirebaseProvider';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, User, Hash, School } from 'lucide-react';

export function Onboarding() {
  const { user, profile } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    registrationNo: profile?.registrationNo || '',
    class: profile?.class || '',
  });

  // Sync fullName if it's fetched from Google profile
  useEffect(() => {
    if (profile?.fullName && !formData.fullName) {
      setFormData(prev => ({ ...prev, fullName: profile.fullName || '' }));
    }
  }, [profile?.fullName, formData.fullName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="text-primary" size={32} />
          </div>
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription>
            Please provide your details to access the CNC quizzes.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User size={16} /> Full Name
              </Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNo" className="flex items-center gap-2">
                <Hash size={16} /> Registration Number
              </Label>
              <Input
                id="registrationNo"
                placeholder="Enter your registration number"
                value={formData.registrationNo}
                onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class" className="flex items-center gap-2">
                <School size={16} /> Class / Section
              </Label>
              <Input
                id="class"
                placeholder="e.g. Mechanical Engineering - Year 3"
                value={formData.class}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                required
                className="h-12"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-12 text-lg font-semibold" disabled={loading}>
              {loading ? 'Saving...' : 'Proceed to Dashboard'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
