'use client';

import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, CheckCircle2, Cpu, GraduationCap, Users, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/components/FirebaseProvider';
import { Badge } from '@/components/ui/badge';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const { user } = useFirebase();
  const router = useRouter();

  const handleGetStarted = async () => {
    if (user) {
      router.push('/dashboard');
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="outline" className="mb-4 px-3 py-1 border-primary/30 text-primary bg-primary/5">
                Precision Training for Modern Manufacturing
              </Badge>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6">
                Master CNC Technology <br />
                <span className="text-primary">Through Interactive Assessment</span>
              </h1>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
                Master the core competencies of <strong>5.0 COMPUTER NUMERICAL CONTROL</strong>, including basic principles, machine functions, and fundamental CNC programming.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button 
                  size="lg" 
                  className="px-8 h-14 text-lg font-semibold gap-2"
                  onClick={handleGetStarted}
                >
                  Get Started Now <ArrowRight size={20} />
                </Button>
                <Button size="lg" variant="outline" className="px-8 h-14 text-lg font-semibold">
                  View Course Catalog
                </Button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-10 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Cpu className="text-primary" size={32} />}
              title="Syllabus Focused"
              description="Content specifically designed for Topic 5.1 (Principles & Functions) and Topic 5.2 (Basic Programming)."
            />
            <FeatureCard 
              icon={<GraduationCap className="text-primary" size={32} />}
              title="Real-time Feedback"
              description="Instant results and detailed explanations for every question to accelerate learning."
            />
            <FeatureCard 
              icon={<BarChart3 className="text-primary" size={32} />}
              title="Progress Analytics"
              description="Track your performance over time with detailed charts and topic-wise breakdown."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">1,200+</div>
              <div className="text-slate-400 uppercase text-xs tracking-widest font-semibold">Active Students</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">50+</div>
              <div className="text-slate-400 uppercase text-xs tracking-widest font-semibold">Quiz Modules</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">15k+</div>
              <div className="text-slate-400 uppercase text-xs tracking-widest font-semibold">Quizzes Taken</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">98%</div>
              <div className="text-slate-400 uppercase text-xs tracking-widest font-semibold">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          <p>© 2024 CNC Quiz Master. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="border-none shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <div className="mb-4">{icon}</div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-slate-600 text-base">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}


