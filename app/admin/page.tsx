'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useFirebase } from '@/components/FirebaseProvider';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Database, BookOpen, Settings, Users, AlertCircle, Search, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { GoogleGenAI, Type } from "@google/genai";

interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  options: string[];
  correctAnswerIndex: number;
  category: string;
  difficulty: string;
  bloomsLevel: string; // C1-C6
  explanation?: string;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questionIds: string[];
  timeLimitMinutes: number;
  totalMarks: number;
  weightagePercent: number;
  startDate: any;
  endDate: any;
}

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

export default function AdminPanel() {
  const { user, isAdmin, loading: authLoading } = useFirebase();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 20;

  // Form states
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    imageUrl: '',
    options: ['', '', '', ''],
    correctAnswerIndex: 0,
    category: '5.1 Basic Principles & Functions',
    difficulty: 'medium',
    bloomsLevel: 'C3',
    explanation: ''
  });

  const [newQuiz, setNewQuiz] = useState({
    title: '',
    description: '',
    questionIds: [] as string[],
    timeLimitMinutes: 60,
    totalMarks: 10,
    weightagePercent: 10,
    startDate: '',
    endDate: ''
  });

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [quizQuestionSearch, setQuizQuestionSearch] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleGenerateAI = async () => {
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      alert("Gemini API key is not configured.");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a CNC related multiple choice question for category "${newQuestion.category}" at Bloom's Level "${newQuestion.bloomsLevel}". 
        The question should be technical and accurate.
        Provide 4 options and the correct answer index (0-3).
        Also provide a brief explanation.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING },
                minItems: 4,
                maxItems: 4
              },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["text", "options", "correctAnswerIndex", "explanation"]
          }
        }
      });

      const data = JSON.parse(response.text);
      setNewQuestion({
        ...newQuestion,
        text: data.text,
        options: data.options,
        correctAnswerIndex: data.correctAnswerIndex,
        explanation: data.explanation
      });
    } catch (err) {
      console.error("AI Generation failed:", err);
      alert("Failed to generate question with AI. Please try again.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleRefineAI = async () => {
    if (!newQuestion.text) {
      alert("Please enter some question text first.");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Refine and improve the following CNC question. 
        Make it more professional, technically accurate, and ensure it matches Bloom's Level "${newQuestion.bloomsLevel}".
        Current Question: "${newQuestion.text}"
        Current Options: ${newQuestion.options.join(', ')}
        
        Provide the refined question in JSON format with text, options (4), correctAnswerIndex, and explanation.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { 
                type: Type.ARRAY,
                items: { type: Type.STRING },
                minItems: 4,
                maxItems: 4
              },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["text", "options", "correctAnswerIndex", "explanation"]
          }
        }
      });

      const data = JSON.parse(response.text);
      setNewQuestion({
        ...newQuestion,
        text: data.text,
        options: data.options,
        correctAnswerIndex: data.correctAnswerIndex,
        explanation: data.explanation
      });
    } catch (err) {
      console.error("AI Refinement failed:", err);
      alert("Failed to refine question with AI.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    const unsubscribeQuestions = onSnapshot(query(collection(db, 'questions')), (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
    });

    const unsubscribeQuizzes = onSnapshot(query(collection(db, 'quizzes')), (snapshot) => {
      setQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
      setLoading(false);
    });

    return () => {
      unsubscribeQuestions();
      unsubscribeQuizzes();
      unsubscribeUsers();
    };
  }, [isAdmin]);

  const handleAddQuestion = async () => {
    try {
      if (editingQuestionId) {
        await updateDoc(doc(db, 'questions', editingQuestionId), newQuestion);
        setEditingQuestionId(null);
      } else {
        await addDoc(collection(db, 'questions'), newQuestion);
      }
      
      setNewQuestion({
        text: '',
        imageUrl: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
        category: '5.1 Basic Principles & Functions',
        difficulty: 'medium',
        bloomsLevel: 'C3',
        explanation: ''
      });
      setIsQuestionDialogOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'questions');
    }
  };

  const handleEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setNewQuestion({
      text: q.text,
      imageUrl: q.imageUrl || '',
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex,
      category: q.category,
      difficulty: q.difficulty,
      bloomsLevel: q.bloomsLevel || 'C3',
      explanation: q.explanation || ''
    });
    setIsQuestionDialogOpen(true);
  };

  const handleAddQuiz = async () => {
    try {
      if (!newQuiz.startDate || !newQuiz.endDate) {
        alert('Please set start and end dates');
        return;
      }

      const quizData = {
        ...newQuiz,
        startDate: new Date(newQuiz.startDate),
        endDate: new Date(newQuiz.endDate),
        createdAt: serverTimestamp()
      };

      if (editingQuizId) {
        await updateDoc(doc(db, 'quizzes', editingQuizId), quizData);
        setEditingQuizId(null);
      } else {
        await addDoc(collection(db, 'quizzes'), quizData);
      }

      setNewQuiz({
        title: '',
        description: '',
        questionIds: [],
        timeLimitMinutes: 60,
        totalMarks: 10,
        weightagePercent: 10,
        startDate: '',
        endDate: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'quizzes');
    }
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setNewQuiz({
      title: quiz.title,
      description: quiz.description,
      questionIds: quiz.questionIds,
      timeLimitMinutes: quiz.timeLimitMinutes,
      totalMarks: quiz.totalMarks || 10,
      weightagePercent: quiz.weightagePercent || 10,
      startDate: quiz.startDate?.toDate().toISOString().slice(0, 16) || '',
      endDate: quiz.endDate?.toDate().toISOString().slice(0, 16) || ''
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteDoc(doc(db, 'questions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `questions/${id}`);
      }
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: 'admin' | 'student') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleToggleUserStatus = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isActive: !currentStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.fullName || u.displayName).toLowerCase().includes(userSearch.toLowerCase()) ||
    u.registrationNo?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const totalUserPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((userPage - 1) * usersPerPage, userPage * usersPerPage);

  const seedData = async () => {
    const set1 = [
      {
        text: "Calculate the spindle speed (RPM) for a 10mm diameter cutter with a recommended cutting speed of 80 m/min.",
        options: ["~1273 RPM", "~2546 RPM", "~3183 RPM", "~5092 RPM"],
        correctAnswerIndex: 1,
        category: "5.1 Basic Principles & Functions",
        difficulty: "medium",
        bloomsLevel: "C3",
        explanation: "RPM = (Cutting Speed * 1000) / (π * Diameter). (80 * 1000) / (3.14 * 10) ≈ 2546."
      },
      {
        text: "Determine the correct G-code block to move the tool linearly from X0 Y0 to X50 Y30 at a feed rate of 120 mm/min.",
        options: ["G00 X50 Y30 F120", "G01 X50 Y30 F120", "G02 X50 Y30 F120", "G03 X50 Y30 F120"],
        correctAnswerIndex: 1,
        category: "5.2 Basic CNC Programming",
        difficulty: "medium",
        bloomsLevel: "C3",
        explanation: "G01 is used for linear interpolation at a controlled feed rate."
      },
      {
        text: "If the current position is X10 Y10, what is the final position after executing 'G91 G01 X20 Y-5'?",
        options: ["X20 Y-5", "X30 Y5", "X30 Y15", "X10 Y5"],
        correctAnswerIndex: 1,
        category: "5.2 Basic CNC Programming",
        difficulty: "hard",
        bloomsLevel: "C3",
        explanation: "G91 is incremental mode. Final X = 10 + 20 = 30. Final Y = 10 - 5 = 5."
      },
      {
        text: "Which M-code sequence should be used to stop the spindle and then end the program?",
        options: ["M03 then M30", "M05 then M02", "M08 then M09", "M06 then M30"],
        correctAnswerIndex: 1,
        category: "5.2 Basic CNC Programming",
        difficulty: "medium",
        bloomsLevel: "C3",
        explanation: "M05 stops the spindle, and M02 (or M30) ends the program."
      },
      {
        text: "Apply the correct G-code to cut a clockwise arc with a radius of 15mm from X0 Y0 to X15 Y15.",
        options: ["G02 X15 Y15 R15", "G03 X15 Y15 R15", "G01 X15 Y15 R15", "G02 X0 Y0 R15"],
        correctAnswerIndex: 0,
        category: "5.2 Basic CNC Programming",
        difficulty: "hard",
        bloomsLevel: "C3",
        explanation: "G02 is clockwise circular interpolation. X and Y are target coordinates, R is radius."
      }
    ];

    const set2 = [
      {
        text: "A 2-flute end mill is running at 1500 RPM with a feed per tooth of 0.05mm. Calculate the table feed rate.",
        options: ["75 mm/min", "150 mm/min", "300 mm/min", "600 mm/min"],
        correctAnswerIndex: 1,
        category: "5.1 Basic Principles & Functions",
        difficulty: "medium",
        bloomsLevel: "C3",
        explanation: "Feed Rate = RPM * Number of Flutes * Feed per Tooth. 1500 * 2 * 0.05 = 150 mm/min."
      },
      {
        text: "Select the appropriate G-code to establish the workpiece coordinate system (Work Offset) at G54.",
        options: ["G53", "G54", "G90", "G92"],
        correctAnswerIndex: 1,
        category: "5.2 Basic CNC Programming",
        difficulty: "easy",
        bloomsLevel: "C3",
        explanation: "G54 is the standard code for the first work coordinate system offset."
      },
      {
        text: "What is the result of executing 'G00 Z5.0' followed by 'G01 Z-2.0 F50'?",
        options: ["Rapid move to Z-2.0", "Linear cut from Z5.0 to Z-2.0 at 50mm/min", "Circular cut to Z-2.0", "The machine will error"],
        correctAnswerIndex: 1,
        category: "5.2 Basic CNC Programming",
        difficulty: "medium",
        bloomsLevel: "C3",
        explanation: "G00 rapids to safe height, G01 performs a controlled linear cut to the specified depth."
      },
      {
        text: "Identify the correct M-code to turn on the flood coolant before starting a cut.",
        options: ["M03", "M07", "M08", "M05"],
        correctAnswerIndex: 2,
        category: "5.1 Basic Principles & Functions",
        difficulty: "easy",
        bloomsLevel: "C3",
        explanation: "M08 is the standard command to turn on flood coolant."
      },
      {
        text: "In a 3-axis CNC Mill, which axis movement corresponds to the command 'G01 Y25.0'?",
        options: ["Vertical spindle movement", "Table movement left/right", "Table movement towards/away from operator", "Spindle rotation"],
        correctAnswerIndex: 2,
        category: "5.1 Basic Principles & Functions",
        difficulty: "medium",
        bloomsLevel: "C3",
        explanation: "The Y-axis typically represents the cross-travel (front-to-back) movement of the table."
      }
    ];

    const set3 = [
      {
        text: "Calculate the time required to mill a slot 200mm long at a feed rate of 40 mm/min.",
        options: ["2 minutes", "4 minutes", "5 minutes", "8 minutes"],
        correctAnswerIndex: 2,
        category: "5.1 Basic Principles & Functions",
        difficulty: "medium",
        bloomsLevel: "C3",
        explanation: "Time = Distance / Feed Rate. 200 / 40 = 5 minutes."
      },
      {
        text: "Which G-code command ensures the machine interprets all coordinates as absolute values from the program origin?",
        options: ["G90", "G91", "G20", "G21"],
        correctAnswerIndex: 0,
        category: "5.2 Basic CNC Programming",
        difficulty: "easy",
        bloomsLevel: "C3",
        explanation: "G90 sets the programming mode to Absolute Positioning."
      },
      {
        text: "Determine the final position of the tool if it starts at X0 Y0 and executes: G90 G01 X10 Y10; G91 X5 Y5;",
        options: ["X5 Y5", "X10 Y10", "X15 Y15", "X50 Y50"],
        correctAnswerIndex: 2,
        category: "5.2 Basic CNC Programming",
        difficulty: "hard",
        bloomsLevel: "C3",
        explanation: "First block moves to absolute (10,10). Second block moves incrementally +5,+5 from there, resulting in (15,15)."
      },
      {
        text: "Select the M-code used to perform an automatic tool change.",
        options: ["M03", "M05", "M06", "M30"],
        correctAnswerIndex: 2,
        category: "5.1 Basic Principles & Functions",
        difficulty: "easy",
        bloomsLevel: "C3",
        explanation: "M06 is the standard command for an automatic tool change (ATC)."
      },
      {
        text: "What does the command 'G03 X20 Y20 R20' do if the start point is X0 Y20?",
        options: ["Cuts a clockwise arc", "Cuts a counter-clockwise arc", "Moves rapidly to X20 Y20", "Drills a hole at X20 Y20"],
        correctAnswerIndex: 1,
        category: "5.2 Basic CNC Programming",
        difficulty: "hard",
        bloomsLevel: "C3",
        explanation: "G03 is counter-clockwise circular interpolation."
      }
    ];

    try {
      const batch = writeBatch(db);
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(now.getDate() + 7);

      const addSet = async (questions: any[], title: string, desc: string) => {
        const refs: string[] = [];
        for (const q of questions) {
          const docRef = doc(collection(db, 'questions'));
          batch.set(docRef, q);
          refs.push(docRef.id);
        }
        const quizRef = doc(collection(db, 'quizzes'));
        batch.set(quizRef, {
          title,
          description: desc,
          questionIds: refs,
          timeLimitMinutes: 60,
          totalMarks: 10,
          weightagePercent: 10,
          startDate: now,
          endDate: nextWeek,
          createdAt: serverTimestamp()
        });
      };

      await addSet(set1, "CNC Assessment Set A", "Focus on basic calculations and G-code logic (C3 Level).");
      await addSet(set2, "CNC Assessment Set B", "Focus on feed rates and coordinate systems (C3 Level).");
      await addSet(set3, "CNC Assessment Set C", "Focus on machining time and positioning modes (C3 Level).");

      await batch.commit();
      alert('3 Sets of Syllabus-aligned Questions and Quizzes added successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batch');
    }
  };

  if (authLoading || (isAdmin && loading)) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-slate-500 mb-8">You do not have administrator privileges to view this page.</p>
          <Link href="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Control Panel</h1>
            <p className="text-slate-500">Manage your CNC question bank and quiz modules.</p>
          </div>
          <Button variant="outline" onClick={seedData} className="gap-2">
            <Database size={18} /> Seed Sample Data
          </Button>
        </div>

        <Tabs defaultValue="questions" className="space-y-6">
          <TabsList className="bg-white border">
            <TabsTrigger value="questions" className="gap-2">
              <BookOpen size={16} /> Question Bank
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="gap-2">
              <Settings size={16} /> Quiz Management
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users size={16} /> User Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Question Bank</CardTitle>
                  <CardDescription>Total {questions.length} questions available.</CardDescription>
                </div>
                <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" onClick={() => {
                      setEditingQuestionId(null);
                      setNewQuestion({
                        text: '',
                        imageUrl: '',
                        options: ['', '', '', ''],
                        correctAnswerIndex: 0,
                        category: '5.1 Basic Principles & Functions',
                        difficulty: 'medium',
                        bloomsLevel: 'C3',
                        explanation: ''
                      });
                    }}>
                      <Plus size={18} /> Add Question
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {editingQuestionId ? 'Edit Question' : 'Create New Question'}
                        <div className="ml-auto flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs gap-1.5 h-8 border-primary/20 hover:border-primary/50 hover:bg-primary/5"
                            onClick={handleGenerateAI}
                            disabled={isGeneratingAI}
                          >
                            {isGeneratingAI ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} className="text-primary" />
                            )}
                            Generate
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs gap-1.5 h-8 border-primary/20 hover:border-primary/50 hover:bg-primary/5"
                            onClick={handleRefineAI}
                            disabled={isGeneratingAI || !newQuestion.text}
                          >
                            {isGeneratingAI ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Sparkles size={14} className="text-amber-500" />
                            )}
                            Refine
                          </Button>
                        </div>
                      </DialogTitle>
                      <DialogDescription>
                        {editingQuestionId ? 'Update the existing question.' : 'Add a new CNC related question to the bank.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="text">Question Text</Label>
                        <Input id="text" value={newQuestion.text} onChange={e => setNewQuestion({...newQuestion, text: e.target.value})} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="imageUrl">Figure/Diagram URL (Optional)</Label>
                        <Input id="imageUrl" value={newQuestion.imageUrl} onChange={e => setNewQuestion({...newQuestion, imageUrl: e.target.value})} placeholder="https://example.com/image.png" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Category</Label>
                          <Select value={newQuestion.category} onValueChange={v => setNewQuestion({...newQuestion, category: v as string})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5.1 Basic Principles & Functions">5.1 Basic Principles & Functions</SelectItem>
                              <SelectItem value="5.2 Basic CNC Programming">5.2 Basic CNC Programming</SelectItem>
                              <SelectItem value="G-Codes">G-Codes</SelectItem>
                              <SelectItem value="M-Codes">M-Codes</SelectItem>
                              <SelectItem value="Tooling">Tooling</SelectItem>
                              <SelectItem value="Safety">Safety</SelectItem>
                              <SelectItem value="Coordinate Systems">Coordinate Systems</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Difficulty</Label>
                          <Select value={newQuestion.difficulty} onValueChange={v => setNewQuestion({...newQuestion, difficulty: v as string})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Bloom&apos;s Level</Label>
                          <Select value={newQuestion.bloomsLevel} onValueChange={v => setNewQuestion({...newQuestion, bloomsLevel: v as string})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="C1">C1 - Knowledge</SelectItem>
                              <SelectItem value="C2">C2 - Comprehension</SelectItem>
                              <SelectItem value="C3">C3 - Application</SelectItem>
                              <SelectItem value="C4">C4 - Analysis</SelectItem>
                              <SelectItem value="C5">C5 - Evaluation</SelectItem>
                              <SelectItem value="C6">C6 - Creation</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Options</Label>
                        {newQuestion.options.map((opt, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input 
                              type="radio" 
                              checked={newQuestion.correctAnswerIndex === i} 
                              onChange={() => setNewQuestion({...newQuestion, correctAnswerIndex: i})}
                            />
                            <Input value={opt} onChange={e => {
                              const opts = [...newQuestion.options];
                              opts[i] = e.target.value;
                              setNewQuestion({...newQuestion, options: opts});
                            }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="explanation">Explanation (Optional)</Label>
                        <Input id="explanation" value={newQuestion.explanation} onChange={e => setNewQuestion({...newQuestion, explanation: e.target.value})} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddQuestion}>Save Question</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Bloom&apos;s</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium max-w-md truncate">{q.text}</TableCell>
                        <TableCell><Badge variant="outline">{q.category}</Badge></TableCell>
                        <TableCell>
                          <Badge className={
                            q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                            q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }>{q.difficulty}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{q.bloomsLevel || 'C1'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditQuestion(q)}><Edit size={16} /></Button>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteQuestion(q.id)}><Trash2 size={16} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quizzes">
            <div className="space-y-6">
              <Card id="quiz-form">
                <CardHeader>
                  <CardTitle>{editingQuizId ? 'Edit Quiz' : 'Create New Quiz'}</CardTitle>
                  <CardDescription>
                    {editingQuizId ? 'Update the selected quiz module.' : 'Configure a new quiz module.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quiz Title</Label>
                      <Input value={newQuiz.title} onChange={e => setNewQuiz({...newQuiz, title: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Time Limit (Minutes)</Label>
                      <Input type="number" value={newQuiz.timeLimitMinutes} onChange={e => setNewQuiz({...newQuiz, timeLimitMinutes: parseInt(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Marks</Label>
                      <Input type="number" value={newQuiz.totalMarks} onChange={e => setNewQuiz({...newQuiz, totalMarks: parseInt(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={newQuiz.description} onChange={e => setNewQuiz({...newQuiz, description: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Weightage (%)</Label>
                      <Input type="number" value={newQuiz.weightagePercent} onChange={e => setNewQuiz({...newQuiz, weightagePercent: parseInt(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date & Time</Label>
                      <Input type="datetime-local" value={newQuiz.startDate} onChange={e => setNewQuiz({...newQuiz, startDate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date & Time</Label>
                      <Input type="datetime-local" value={newQuiz.endDate} onChange={e => setNewQuiz({...newQuiz, endDate: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label>Select Questions ({newQuiz.questionIds.length} selected)</Label>
                      <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input 
                          placeholder="Search questions..." 
                          className="pl-8 h-8 text-xs" 
                          value={quizQuestionSearch}
                          onChange={e => setQuizQuestionSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md bg-slate-50/50">
                      {questions
                        .filter(q => q.text.toLowerCase().includes(quizQuestionSearch.toLowerCase()))
                        .map(q => (
                        <div key={q.id} className="flex items-center gap-2 p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded transition-all">
                          <input 
                            type="checkbox" 
                            id={`q-${q.id}`}
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                            checked={newQuiz.questionIds.includes(q.id)}
                            onChange={(e) => {
                              const ids = e.target.checked 
                                ? [...newQuiz.questionIds, q.id]
                                : newQuiz.questionIds.filter(id => id !== q.id);
                              setNewQuiz({...newQuiz, questionIds: ids});
                            }}
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <Label htmlFor={`q-${q.id}`} className="text-xs truncate cursor-pointer font-normal">
                              {q.text}
                            </Label>
                            <div className="flex gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[10px] h-4 px-1">{q.bloomsLevel || 'C1'}</Badge>
                              <Badge variant="outline" className="text-[10px] h-4 px-1">{q.difficulty}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {newQuiz.questionIds.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle size={16} className="text-primary" />
                        Quiz Blueprint Summary
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">Total Questions</p>
                          <p className="text-lg font-bold">{newQuiz.questionIds.length}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">C3 (Application) Level</p>
                          <p className="text-lg font-bold">
                            {Math.round((questions.filter(q => newQuiz.questionIds.includes(q.id) && q.bloomsLevel === 'C3').length / newQuiz.questionIds.length) * 100)}%
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">Avg. Time / Question</p>
                          <p className="text-lg font-bold">{Math.round(newQuiz.timeLimitMinutes / newQuiz.questionIds.length)} min</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-500">Marks / Question</p>
                          <p className="text-lg font-bold">{(newQuiz.totalMarks / newQuiz.questionIds.length).toFixed(2)}</p>
                        </div>
                      </div>
                      {Math.round((questions.filter(q => newQuiz.questionIds.includes(q.id) && q.bloomsLevel === 'C3').length / newQuiz.questionIds.length) * 100) < 60 && (
                        <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                          <AlertCircle size={10} />
                          Tip: Majority should be C3 level (at least 60%) for this assessment type.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button onClick={handleAddQuiz} className="flex-1">
                    {editingQuizId ? 'Update Quiz' : 'Create Quiz'}
                  </Button>
                  {editingQuizId && (
                    <Button variant="outline" onClick={() => {
                      setEditingQuizId(null);
                      setNewQuiz({
                        title: '',
                        description: '',
                        questionIds: [],
                        timeLimitMinutes: 30,
                        startDate: '',
                        endDate: ''
                      });
                    }}>Cancel</Button>
                  )}
                </CardFooter>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quizzes.map(quiz => (
                  <Card key={quiz.id} className={editingQuizId === quiz.id ? 'ring-2 ring-primary' : ''}>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-start">
                        {quiz.title}
                        {editingQuizId === quiz.id && <Badge>Editing</Badge>}
                      </CardTitle>
                      <CardDescription className="line-clamp-1">{quiz.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        <span>{quiz.questionIds.length} Questions</span>
                        <span>{quiz.timeLimitMinutes} Minutes</span>
                        <span>{quiz.totalMarks || 10} Marks</span>
                        <span>{quiz.weightagePercent || 10}% Weightage</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Available: {quiz.startDate?.toDate().toLocaleString()} - {quiz.endDate?.toDate().toLocaleString()}
                      </div>
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditQuiz(quiz)}>
                        <Edit size={14} className="mr-1" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={async () => {
                        if (confirm('Delete this quiz?')) {
                          await deleteDoc(doc(db, 'quizzes', quiz.id));
                        }
                      }}>
                        <Trash2 size={14} className="mr-1" /> Delete
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View and manage user roles and account status.</CardDescription>
                </div>
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search users..."
                    className="pl-9"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map((u) => (
                      <TableRow key={u.uid}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{u.fullName || u.displayName}</span>
                            <span className="text-xs text-slate-500">{u.registrationNo || 'No Reg No.'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Select 
                            value={u.role} 
                            onValueChange={(v) => handleUpdateUserRole(u.uid, v as 'admin' | 'student')}
                            disabled={u.uid === user?.uid} // Don't let admin change their own role here
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="student">Student</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge className={u.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {u.isActive !== false ? 'Active' : 'Deactivated'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled={u.uid === user?.uid}
                            onClick={() => handleToggleUserStatus(u.uid, u.isActive !== false)}
                          >
                            {u.isActive !== false ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {totalUserPages > 1 && (
                  <div className="flex items-center justify-between space-x-2 py-4">
                    <div className="text-sm text-slate-500">
                      Showing {((userPage - 1) * usersPerPage) + 1} to {Math.min(userPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserPage(p => Math.max(1, p - 1))}
                        disabled={userPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalUserPages }, (_, i) => i + 1).map((p) => (
                          <Button
                            key={p}
                            variant={userPage === p ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setUserPage(p)}
                          >
                            {p}
                          </Button>
                        )).filter((_, i) => {
                          // Only show current page, first, last, and neighbors
                          if (totalUserPages <= 7) return true;
                          return i === 0 || i === totalUserPages - 1 || Math.abs(i - (userPage - 1)) <= 1;
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                        disabled={userPage === totalUserPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
