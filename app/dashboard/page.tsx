'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useFirebase } from '@/components/FirebaseProvider';
import { collection, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, BookOpen, Trophy, Calendar, ArrowRight, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Onboarding } from '@/components/Onboarding';

interface Quiz {
  id: string;
  title: string;
  description: string;
  questionIds: string[];
  timeLimitMinutes: number;
  startDate: any;
  endDate: any;
  createdAt: any;
}

interface Attempt {
  id: string;
  quizId: string;
  score: number;
  startedAt: any;
  completedAt: any;
  quizTitle?: string;
}

export default function Dashboard() {
  const { user, profile, loading: authLoading, isOnboarded } = useFirebase();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const quizzesQuery = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    const unsubscribeQuizzes = onSnapshot(quizzesQuery, (snapshot) => {
      const now = new Date();
      const quizData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz))
        .filter(quiz => {
          if (profile?.role === 'admin') return true;
          const start = quiz.startDate?.toDate();
          const end = quiz.endDate?.toDate();
          return start && end && now >= start && now <= end;
        });
      setQuizzes(quizData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'quizzes'));

    const attemptsQuery = query(
      collection(db, 'attempts'),
      where('userId', '==', user.uid),
      orderBy('completedAt', 'desc')
    );
    const unsubscribeAttempts = onSnapshot(attemptsQuery, (snapshot) => {
      const attemptData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attempt));
      setAttempts(attemptData);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attempts'));

    return () => {
      unsubscribeQuizzes();
      unsubscribeAttempts();
    };
  }, [user, profile?.role]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in to access your dashboard</h2>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">Welcome back, {profile?.displayName}!</h1>
          <p className="text-slate-500">Ready to test your CNC knowledge today?</p>
        </header>

        <Tabs defaultValue="quizzes" className="space-y-8">
          <TabsList className="bg-white border p-1 h-12">
            <TabsTrigger value="quizzes" className="px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              Available Quizzes
            </TabsTrigger>
            <TabsTrigger value="attempts" className="px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-white">
              My History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quizzes">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.length > 0 ? (
                quizzes.map((quiz, index) => (
                  <motion.div
                    key={quiz.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">
                            CNC Basics
                          </Badge>
                          <div className="flex items-center text-slate-400 text-xs gap-1">
                            <Clock size={14} />
                            {quiz.timeLimitMinutes}m
                          </div>
                        </div>
                        <CardTitle className="text-xl">{quiz.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {quiz.description || 'No description provided.'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <BookOpen size={16} />
                            {quiz.questionIds.length} Questions
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="border-t pt-4">
                        <Link href={`/quiz/${quiz.id}`} className="w-full">
                          <Button className="w-full gap-2">
                            <PlayCircle size={18} />
                            Start Quiz
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-white rounded-xl border border-dashed">
                  <BookOpen className="mx-auto text-slate-300 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-slate-900">No quizzes available yet</h3>
                  <p className="text-slate-500">Check back later for new CNC modules.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attempts">
            <div className="bg-white rounded-xl border overflow-hidden">
              {attempts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quiz</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attempts.map((attempt) => (
                        <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">
                              {quizzes.find(q => q.id === attempt.quizId)?.title || 'Unknown Quiz'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} />
                              {attempt.completedAt?.toDate().toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${attempt.score >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                                {attempt.score}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {attempt.score >= 70 ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Passed</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Review Needed</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link href={`/result/${attempt.id}`}>
                              <Button variant="ghost" size="sm" className="gap-1.5">
                                View Analysis <ArrowRight size={14} />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <Trophy className="mx-auto text-slate-300 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-slate-900">No attempts yet</h3>
                  <p className="text-slate-500">Complete your first quiz to see your progress here.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
