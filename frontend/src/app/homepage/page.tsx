'use client';

import { CTASection } from '@/components/home/sections/cta-section';
import { FooterSection } from '@/components/home/sections/footer-section';
import { HeroSection } from '@/components/home/sections/hero-section';
import { OpenSourceSection } from '@/components/home/sections/open-source-section';
import { PricingSection } from '@/components/home/sections/pricing-section';
import { UseCasesSection } from '@/components/home/sections/use-cases-section';
import { ModalProviders } from '@/providers/modal-providers';
import { HeroVideoSection } from '@/components/home/sections/hero-video-section';
import { BackgroundAALChecker } from '@/components/auth/background-aal-checker';
// Reference layout does not use these extra sections; keep imports minimal

export default function Homepage() {
  // No redirect logic - accessible to everyone (logged-in and non-logged-in users)
  return (
    <>
      <ModalProviders />
      <BackgroundAALChecker>
        <main className="flex flex-col items-center justify-center min-h-screen w-full">
          <div className="w-full divide-y divide-border">
            {/* Reference homepage structure with our providers/wrappers preserved */}
            <HeroSection />
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

