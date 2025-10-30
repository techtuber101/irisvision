'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CTASection } from '@/components/home/sections/cta-section';
import { FooterSection } from '@/components/home/sections/footer-section';
import { HeroSection } from '@/components/home/sections/hero-section';
import { OpenSourceSection } from '@/components/home/sections/open-source-section';
import { PricingSection } from '@/components/home/sections/pricing-section';
import { UseCasesSection } from '@/components/home/sections/use-cases-section';
import { MadeInIndiaSection } from '@/components/home/sections/made-in-india-section';
import { ModalProviders } from '@/providers/modal-providers';
import { HeroVideoSection } from '@/components/home/sections/hero-video-section';
import { BackgroundAALChecker } from '@/components/auth/background-aal-checker';
import { useAuth } from '@/components/AuthProvider';
// Reference layout does not use these extra sections; keep imports minimal

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return null; // Or you could show a loading spinner here
  }

  // Don't render homepage content if user is logged in (redirect will happen)
  if (user) {
    return null;
  }

  return (
    <>
      <ModalProviders />
      <BackgroundAALChecker>
        <main className="flex flex-col items-center justify-center min-h-screen w-full">
          <div className="w-full divide-y divide-border">
            {/* Reference homepage structure with our providers/wrappers preserved */}
            <HeroSection />
            <MadeInIndiaSection />
            <OpenSourceSection />
            <UseCasesSection />
            <div className='flex flex-col items-center px-4'>
              <PricingSection />
            </div>
            <div className="pb-10 mx-auto">
              <HeroVideoSection />
            </div>
            <CTASection />
            <FooterSection />
          </div>
        </main>
      </BackgroundAALChecker>
    </>
  );
}
