'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SubmitButton } from '@/components/ui/submit-button';
import { Input } from '@/components/ui/input';
import GoogleSignIn from '@/components/GoogleSignIn';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { signIn, signUp, forgotPassword } from './actions';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  X,
  CheckCircle,
  AlertCircle,
  MailCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useAuthMethodTracking } from '@/lib/stores/auth-tracking';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import GitHubSignIn from '@/components/GithubSignIn';
import { IrisLogo } from '@/components/sidebar/iris-logo';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const { setTheme } = useTheme();
  const mode = searchParams?.get('mode');
  const returnUrl = searchParams?.get('returnUrl') || searchParams?.get('redirect');
  const message = searchParams?.get('message');
  const errorFromUrl = searchParams?.get('error');

  const isSignUp = mode === 'signup';
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { wasLastMethod: wasEmailLastMethod, markAsUsed: markEmailAsUsed } = useAuthMethodTracking('email');
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);

  // Handle redirect when user is already logged in or becomes available after login
  useEffect(() => {
    if (!isLoading && user && pendingRedirect) {
      // User is available and we have a pending redirect
      const redirectPath = pendingRedirect;
      setPendingRedirect(null); // Clear pending redirect
      router.push(redirectPath);
    } else if (!isLoading && user && !pendingRedirect) {
      // User is logged in but no pending redirect (e.g., page refresh)
      const redirectPath = returnUrl || '/';
      router.push(redirectPath);
    }
  }, [user, isLoading, router, returnUrl, pendingRedirect]);

  useEffect(() => {
    setMounted(true);
    // Enforce dark mode immediately when component mounts
    document.documentElement.classList.add('dark');
    setTheme('dark');
  }, [setTheme]);

  // Handle successful authentication
  const handleAuthSuccess = useCallback((result: any) => {
    if (result?.success && result?.redirectTo) {
      const redirectTo = result.redirectTo;
      // Store the redirect path
      setPendingRedirect(redirectTo);
      
      // Small delay to ensure cookies are set, then check session
      setTimeout(() => {
        const supabase = createClient();
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            // Session is available, refresh router to update server components
            router.refresh();
            // The useEffect above will handle the redirect when user becomes available in state
          } else {
            // Session not available yet, try redirect anyway (middleware will handle auth)
            router.push(redirectTo);
            setPendingRedirect(null);
          }
        }).catch(() => {
          // Error checking session, try redirect anyway
          router.push(redirectTo);
          setPendingRedirect(null);
        });
      }, 200);
      
      // Fallback: redirect after a longer delay if user doesn't become available
      // This handles cases where auth state doesn't update immediately
      setTimeout(() => {
        setPendingRedirect((current) => {
          // If still pending, redirect anyway (middleware will handle auth if needed)
          if (current === redirectTo) {
            router.push(redirectTo);
            return null;
          }
          return current;
        });
      }, 2000);
    }
  }, [router]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 bg-pattern-grid flex items-center justify-center p-4 relative overflow-hidden">
      {/* Geometric shapes - Top Left */}
      <div className="absolute -top-32 -left-32 w-80 h-80 border border-primary/10 rounded-full animate-spin-slow"></div>
      <div className="absolute -top-24 -left-24 w-64 h-64 border border-primary/15 rounded-full animate-spin-slow" style={{ animationDuration: '30s', animationDirection: 'reverse' }}></div>
      
      {/* Geometric shapes - Bottom Right */}
      <div className="absolute -bottom-32 -right-32 w-80 h-80 border border-primary/10 rotate-45 animate-spin-slow"></div>
      <div className="absolute -bottom-24 -right-24 w-64 h-64 border border-primary/15 rotate-45 animate-spin-slow" style={{ animationDuration: '30s', animationDirection: 'reverse' }}></div>
      
      {/* Abstract lines */}
      <div className="absolute top-1/2 left-16 w-[400px] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-y-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent w-full h-full animate-line-shine"></div>
      </div>
      <div className="absolute top-1/2 left-16 w-[400px] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent translate-y-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent w-full h-full animate-line-shine"></div>
      </div>
      
      {/* Floating Info Card - Enclosed between lines */}
      <button 
        onClick={() => setShowModal(true)}
        className="absolute top-1/2 left-16 transform -translate-y-1/2 bg-navy-800/30 backdrop-blur-md border border-navy-600/40 rounded-xl p-3 shadow-lg hover:bg-navy-800/40 transition-all duration-200 cursor-pointer group animate-pulse-slow"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <h4 className="text-xs font-medium text-white/90">What's New</h4>
            <p className="text-xs text-white/70">Iris is now available worldwide rolling out update 1.0.2</p>
          </div>
          <svg className="w-3 h-3 text-white/50 group-hover:text-white/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
      
      {/* Corner accents */}
      <div className="absolute top-0 right-0 w-40 h-40 border-t-2 border-r-2 border-primary/10"></div>
      <div className="absolute bottom-0 left-0 w-40 h-40 border-b-2 border-l-2 border-primary/10"></div>
      
      {/* Hexagon pattern */}
      <svg className="absolute top-1/3 right-20 w-32 h-32 opacity-5 animate-pulse" viewBox="0 0 100 100" style={{ animationDelay: '1s' }}>
        <polygon points="50 1 95 25 95 75 50 99 5 75 5 25" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary"/>
      </svg>

      
      {/* Logo */}
      <div className="absolute top-6 left-6 z-10">
        <Link href="/">
          <IrisLogo size={28} />
        </Link>
      </div>

      {/* Update Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-navy-900/20 backdrop-blur-xl border border-navy-700/30 rounded-3xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white/90 text-xl font-semibold">What's New in Iris 1.0.2</DialogTitle>
            <DialogDescription className="text-white/70">
              Iris just evolved from a conversational AI into a fully agentic system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-white/80">
            <p className="text-sm leading-relaxed">
              With update 1.0.2, Iris just evolved from a conversational AI into a fully agentic system — capable of reasoning, planning, and acting across complex workflows.
            </p>
            <div className="space-y-3">
              <p className="text-sm font-medium text-white/90">✨ New in this release:</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-primary">🧩</span>
                  <span>Agentic Core: Iris can now autonomously plan, call tools, and complete long-running multi-step tasks</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">⚡</span>
                  <span>Execution Graphs: Every action is now traceable, visual, and optimized — no black boxes, just transparent reasoning.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">💬</span>
                  <span>Context Memory: Persistent memory lets Iris understand tasks over sessions and recall previous context seamlessly.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">🎯</span>
                  <span>Task View: A reimagined workspace where Iris thinks, executes, and shows progress — live.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">🎨</span>
                  <span>Refreshed UI: Minimal, fluid, and designed for focus — built with speed and elegance in mind.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">🧠</span>
                  <span>Smarter Planning: New reasoning layer improves decision-making, tool sequencing, and self-correction.</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowModal(false)}
              className="bg-black hover:bg-black/90 text-white"
            >
              Got it!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Main content */}
      <div className="relative w-full max-w-md mx-auto">
        <div className="relative rounded-3xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden transform hover:scale-[1.02] transition-all duration-300 ease-out">
          {/* Gradient border */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl" style={{
            background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1px',
            borderRadius: '24px'
          }}></div>
          
          {/* Top glow */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen'
          }}></div>
          
          {/* Noise texture */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
            backgroundSize: '100px 100px',
            mixBlendMode: 'overlay'
          }}></div>
          
          {/* Corner dots */}
          <div className="pointer-events-none" aria-hidden="true">
            <div className="absolute left-3 top-3 h-1.5 w-1.5 rounded-full bg-white/30"></div>
            <div className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-white/30"></div>
            <div className="absolute left-3 bottom-3 h-1.5 w-1.5 rounded-full bg-white/30"></div>
            <div className="absolute right-3 bottom-3 h-1.5 w-1.5 rounded-full bg-white/30"></div>
          </div>
          
          <div className="p-8">
          <div className="relative z-10 text-center mb-8">
            <div className="mb-6">
              <Image
                src="/irislogowhitebig.png"
                alt="Iris Logo"
                width={120}
                height={22}
                className="mx-auto h-6 w-auto drop-shadow-lg"
              />
            </div>
            <h1 className="text-2xl font-semibold text-white/90 mb-2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-white/70 text-sm">
              {isSignUp ? 'Sign up to get started with Iris' : 'Sign in to your account to continue'}
            </p>
          </div>

          <div className="space-y-6">
            {message && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center">
                {message}
              </div>
            )}

            {errorFromUrl && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {decodeURIComponent(errorFromUrl)}
              </div>
            )}

            <form className="space-y-4">
              {/* Hidden fields for server actions */}
              <input type="hidden" name="origin" value={typeof window !== 'undefined' ? window.location.origin : ''} />
              {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
              
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white/80">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  className="bg-navy-800/30 border-navy-600/40 text-white placeholder:text-white/50 focus:border-primary/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-white/80">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  className="bg-navy-800/30 border-navy-600/40 text-white placeholder:text-white/50 focus:border-primary/50"
                  required
                />
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-white/80">
                    Confirm Password
                  </label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    className="bg-navy-800/30 border-navy-600/40 text-white placeholder:text-white/50 focus:border-primary/50"
                    required
                  />
                </div>
              )}

              {!isSignUp && (
                <div className="text-right">
                  <Link
                    href="/auth?mode=forgot"
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <SubmitButton 
                formAction={isSignUp ? signUp : signIn}
                onSuccess={handleAuthSuccess}
                className="w-full bg-primary hover:bg-primary/90 text-black font-medium py-2.5 rounded-lg transition-colors"
              >
                {isSignUp ? 'Sign up' : 'Sign in'}
              </SubmitButton>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-navy-600/30"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-4 text-white/50">or continue with email</span>
              </div>
            </div>

            <div className="space-y-3">
              <GoogleSignIn />
              <GitHubSignIn />
            </div>

            <div className="text-center text-sm text-white/60">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <Link
                    href="/auth"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <Link
                    href="/auth?mode=signup"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>}>
      <LoginContent />
    </Suspense>
  );
}