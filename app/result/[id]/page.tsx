'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useFirebase } from '@/components/FirebaseProvider';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, ArrowLeft, CheckCircle2, XCircle, Info, BarChart3, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Link from 'next/link';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  category: string;
  explanation?: string;
}

interface Attempt {
  id: string;
  quizId: string;
  score: number;
  answers: number[];
  startedAt: any;
  completedAt: any;
}

interface Quiz {
  id: string;
  title: string;
  questionIds: string[];
}

export default function ResultPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useFirebase();
  
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const fetchResultData = async () => {
      try {
        const attemptDoc = await getDoc(doc(db, 'attempts', id as string));
        if (!attemptDoc.exists()) {
          router.push('/dashboard');
          return;
        }
        
        const attemptData = { id: attemptDoc.id, ...attemptDoc.data() } as Attempt;
        setAttempt(attemptData);

        const quizDoc = await getDoc(doc(db, 'quizzes', attemptData.quizId));
        if (quizDoc.exists()) {
          const quizData = { id: quizDoc.id, ...quizDoc.data() } as Quiz;
          setQuiz(quizData);

          // Fetch questions
          const questionsQuery = query(
            collection(db, 'questions'),
            where('__name__', 'in', quizData.questionIds)
          );
          const questionsSnapshot = await getDocs(questionsQuery);
          const questionsData = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          
          // Sort questions
          const sortedQuestions = quizData.questionIds.map(qId => 
            questionsData.find(q => q.id === qId)
          ).filter(Boolean) as Question[];

          setQuestions(sortedQuestions);
        }
        setLoading(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `attempts/${id}`);
      }
    };

    fetchResultData();
  }, [id, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!attempt || !quiz) return null;

  const correctCount = questions.filter((q, i) => attempt.answers[i] === q.correctAnswerIndex).length;
  const incorrectCount = questions.length - correctCount;

  const chartData = [
    { name: 'Correct', value: correctCount },
    { name: 'Incorrect', value: incorrectCount },
  ];

  const COLORS = ['#10b981', '#ef4444'];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-5xl mx-auto px-4 py-10">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:text-primary flex items-center gap-1 mb-2 transition-colors">
              <ArrowLeft size={14} /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-slate-900">Quiz Results</h1>
            <p className="text-slate-500">{quiz.title}</p>
          </div>
          <div className="flex gap-3">
            <Link href={`/quiz/${quiz.id}`}>
              <Button variant="outline" className="gap-2">
                <RotateCcw size={18} /> Retake Quiz
              </Button>
            </Link>
            <Button className="gap-2">
              Share Results
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Score Card */}
          <Card className="lg:col-span-1 border-none shadow-lg overflow-hidden">
            <div className={`h-2 ${attempt.score >= 70 ? 'bg-green-500' : 'bg-amber-500'}`} />
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Trophy className={attempt.score >= 70 ? 'text-amber-500' : 'text-slate-400'} size={40} />
              </div>
              <CardTitle className="text-4xl font-black">{attempt.score}%</CardTitle>
              <CardDescription className="text-lg font-medium">
                {attempt.score >= 70 ? 'Congratulations! You Passed' : 'Keep practicing!'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-green-600 font-bold text-xl">{correctCount}</div>
                  <div className="text-green-700 text-xs uppercase font-semibold">Correct</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <div className="text-red-600 font-bold text-xl">{incorrectCount}</div>
                  <div className="text-red-700 text-xs uppercase font-semibold">Incorrect</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" /> Question Review
            </h2>
            
            {questions.map((q, i) => {
              const isCorrect = attempt.answers[i] === q.correctAnswerIndex;
              const userAnswer = attempt.answers[i];
              
              return (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`border-l-4 ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardHeader className="py-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question {i + 1}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{q.category}</Badge>
                          </div>
                          <CardTitle className="text-base font-semibold leading-snug">
                            {q.text}
                          </CardTitle>
                        </div>
                        {isCorrect ? (
                          <CheckCircle2 className="text-green-500 shrink-0" size={24} />
                        ) : (
                          <XCircle className="text-red-500 shrink-0" size={24} />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="space-y-2">
                        {q.options.map((option, optIdx) => {
                          let bgColor = 'bg-white';
                          let borderColor = 'border-slate-100';
                          let textColor = 'text-slate-600';

                          if (optIdx === q.correctAnswerIndex) {
                            bgColor = 'bg-green-50';
                            borderColor = 'border-green-200';
                            textColor = 'text-green-700';
                          } else if (optIdx === userAnswer && !isCorrect) {
                            bgColor = 'bg-red-50';
                            borderColor = 'border-red-200';
                            textColor = 'text-red-700';
                          }

                          return (
                            <div 
                              key={optIdx} 
                              className={`p-2.5 rounded-lg border text-sm flex items-center gap-3 ${bgColor} ${borderColor} ${textColor}`}
                            >
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                optIdx === q.correctAnswerIndex ? 'bg-green-500 border-green-500 text-white' : 
                                optIdx === userAnswer ? 'bg-red-500 border-red-500 text-white' : 'border-slate-300'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </div>
                              {option}
                            </div>
                          );
                        })}
                      </div>
                      
                      {q.explanation && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex gap-3">
                          <Info className="text-blue-500 shrink-0" size={18} />
                          <div className="text-xs text-blue-700 leading-relaxed">
                            <span className="font-bold uppercase block mb-1">Explanation:</span>
                            {q.explanation}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
