'use client';

import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
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
import DashboardLayoutContent from '@/components/dashboard/layout-content';
import { DashboardContent } from '@/components/dashboard/dashboard-content';
import { IrisLoadingScreen } from '@/components/ui/iris-loading-screen';

export default function Home() {
  const { user, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return <IrisLoadingScreen />;
  }

  // If user is logged in, show dashboard with full layout at root
  if (user) {
    return (
      <DashboardLayoutContent>
        <Suspense
          fallback={
            <div className="flex flex-col h-full w-full">
              <div className="flex-1 flex flex-col items-center justify-center px-4">
                <div className={cn(
                  "flex flex-col items-center text-center w-full space-y-8",
                  "max-w-[850px] sm:max-w-full sm:px-4"
                )}>
                  <Skeleton className="h-10 w-40 sm:h-8 sm:w-32" />
                  <Skeleton className="h-7 w-56 sm:h-6 sm:w-48" />
                  <Skeleton className="w-full h-[100px] rounded-xl sm:h-[80px]" />
                  <div className="block sm:hidden lg:block w-full">
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
              </div>
            </div>
          }
        >
          <DashboardContent />
        </Suspense>
      </DashboardLayoutContent>
    );
  }

  // Show homepage for non-logged-in users
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
