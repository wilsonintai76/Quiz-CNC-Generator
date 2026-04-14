'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useFirebase } from '@/components/FirebaseProvider';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, ChevronRight, ChevronLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  options: string[];
  correctAnswerIndex: number;
  category: string;
  difficulty: string;
  explanation?: string;
  shuffledOptions?: { text: string; originalIndex: number }[];
}

interface Quiz {
  id: string;
  title: string;
  questionIds: string[];
  timeLimitMinutes: number;
  startDate: any;
  endDate: any;
}

export default function QuizPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useFirebase();
  
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [startedAt] = useState(new Date());

  useEffect(() => {
    if (!id || !user) return;

    const fetchQuizData = async () => {
      try {
        const quizDoc = await getDoc(doc(db, 'quizzes', id as string));
        if (!quizDoc.exists()) {
          router.push('/dashboard');
          return;
        }
        
        const quizData = { id: quizDoc.id, ...quizDoc.data() } as Quiz;
        setQuiz(quizData);
        setTimeLeft(quizData.timeLimitMinutes * 60);

        // Fetch questions
        const questionsQuery = query(
          collection(db, 'questions'),
          where('__name__', 'in', quizData.questionIds)
        );
        const questionsSnapshot = await getDocs(questionsQuery);
        let questionsData = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
        
        // Randomize question sequence
        questionsData = questionsData.sort(() => Math.random() - 0.5);

        // Randomize options for each question
        const processedQuestions = questionsData.map(q => {
          const shuffledOptions = q.options.map((text, originalIndex) => ({ text, originalIndex }))
            .sort(() => Math.random() - 0.5);
          return { ...q, shuffledOptions };
        });

        setQuestions(processedQuestions);
        setLoading(false);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `quizzes/${id}`);
      }
    };

    fetchQuizData();
  }, [id, user, router]);

  const handleSubmit = useCallback(async () => {
    if (!quiz || !user || isSubmitting) return;
    setIsSubmitting(true);

    // Map selected shuffled indices back to original indices
    const answersArray = questions.map((q, index) => {
      const selectedShuffledIndex = selectedAnswers[index];
      if (selectedShuffledIndex === undefined) return -1;
      return q.shuffledOptions![selectedShuffledIndex].originalIndex;
    });
    
    // Calculate score
    let correctCount = 0;
    questions.forEach((q, index) => {
      const selectedShuffledIndex = selectedAnswers[index];
      if (selectedShuffledIndex !== undefined) {
        const originalIndex = q.shuffledOptions![selectedShuffledIndex].originalIndex;
        if (originalIndex === q.correctAnswerIndex) {
          correctCount++;
        }
      }
    });
    
    const score = Math.round((correctCount / questions.length) * 100);

    try {
      const attemptData = {
        userId: user.uid,
        quizId: quiz.id,
        score,
        answers: answersArray,
        startedAt: startedAt,
        completedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'attempts'), attemptData);
      router.push(`/result/${docRef.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attempts');
    }
  }, [quiz, user, isSubmitting, questions, selectedAnswers, startedAt, router]);

  // Timer effect
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isSubmitting) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitting, handleSubmit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (isReviewing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="max-w-4xl mx-auto w-full px-4 py-8">
          <header className="mb-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold">Review Your Answers</h1>
            <Button variant="outline" onClick={() => setIsReviewing(false)}>Back to Quiz</Button>
          </header>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 mb-8">
            {questions.map((_, index) => (
              <Button
                key={index}
                variant={selectedAnswers[index] !== undefined ? "default" : "outline"}
                className="h-16 text-lg font-bold"
                onClick={() => {
                  setCurrentQuestionIndex(index);
                  setIsReviewing(false);
                }}
              >
                {index + 1}
              </Button>
            ))}
          </div>
          <Card className="p-6 text-center">
            <p className="text-slate-600 mb-6">You have answered {Object.keys(selectedAnswers).length} out of {questions.length} questions.</p>
            <Button size="lg" className="w-full sm:w-auto px-12 h-14 text-lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Confirm & Submit Quiz'}
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <div className="flex-grow max-w-4xl mx-auto w-full px-4 py-6 md:py-8">
        <header className="mb-6 md:mb-8 space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate max-w-[60%]">{quiz?.title}</h1>
            <div className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full font-mono font-bold text-sm md:text-base ${timeLeft !== null && timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
              <Clock size={16} className="md:w-[18px] md:h-[18px]" />
              {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs md:text-sm font-medium text-slate-500">
              <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-1.5 md:h-2" />
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-none shadow-xl overflow-hidden">
              {currentQuestion.imageUrl && (
                <div className="w-full aspect-video relative bg-slate-100 border-b">
                  <Image 
                    src={currentQuestion.imageUrl} 
                    alt="Question figure" 
                    fill
                    className="object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <CardHeader className="pb-4">
                <div className="flex gap-2 mb-3">
                  <Badge variant="secondary" className="uppercase text-[9px] md:text-[10px] tracking-wider">
                    {currentQuestion.category}
                  </Badge>
                  <Badge variant="outline" className={`uppercase text-[9px] md:text-[10px] tracking-wider ${
                    currentQuestion.difficulty === 'easy' ? 'text-green-600 border-green-200 bg-green-50' :
                    currentQuestion.difficulty === 'medium' ? 'text-amber-600 border-amber-200 bg-amber-50' :
                    'text-red-600 border-red-200 bg-red-50'
                  }`}>
                    {currentQuestion.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-lg md:text-xl leading-relaxed font-semibold text-slate-800">
                  {currentQuestion.text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {currentQuestion.shuffledOptions?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: index }))}
                    className={`w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 md:gap-4 group ${
                      selectedAnswers[currentQuestionIndex] === index
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center text-[10px] md:text-xs font-bold shrink-0 ${
                      selectedAnswers[currentQuestionIndex] === index
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-300 text-slate-400 group-hover:border-slate-400'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="font-medium text-sm md:text-base">{option.text}</span>
                  </button>
                ))}
              </CardContent>
              <CardFooter className="flex justify-between border-t p-4 md:p-6 mt-2">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="gap-1 md:gap-2 text-sm"
                >
                  <ChevronLeft size={16} className="md:w-[18px] md:h-[18px]" /> Previous
                </Button>
                
                {currentQuestionIndex === questions.length - 1 ? (
                  <Button 
                    onClick={() => setIsReviewing(true)} 
                    className="px-6 md:px-8 bg-green-600 hover:bg-green-700 gap-1 md:gap-2 text-sm"
                  >
                    Review & Submit <CheckCircle2 size={16} className="md:w-[18px] md:h-[18px]" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    className="gap-1 md:gap-2 text-sm"
                  >
                    Next <ChevronRight size={16} className="md:w-[18px] md:h-[18px]" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 md:mt-8 flex flex-wrap gap-1.5 md:gap-2 justify-center">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-7 h-7 md:w-8 md:h-8 rounded-md text-[10px] md:text-xs font-bold transition-all ${
                currentQuestionIndex === index 
                  ? 'bg-primary text-white scale-110 shadow-md' 
                  : selectedAnswers[index] !== undefined
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
