import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { FirebaseProvider } from '@/components/FirebaseProvider';
import { AuthGuard } from '@/components/AuthGuard';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'CNC Quiz Master',
  description: 'Online CNC training and assessment platform',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <FirebaseProvider>
          <AuthGuard>
            {children}
          </AuthGuard>
        </FirebaseProvider>
      </body>
    </html>
  );
}
