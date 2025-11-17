'use client';

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
import dynamic from 'next/dynamic';
// Reference layout does not use these extra sections; keep imports minimal

// Lazy load below-the-fold sections for better initial load performance
const LazyMadeInIndiaSection = dynamic(() => import('@/components/home/sections/made-in-india-section').then(mod => ({ default: mod.MadeInIndiaSection })), { ssr: true });
const LazyOpenSourceSection = dynamic(() => import('@/components/home/sections/open-source-section').then(mod => ({ default: mod.OpenSourceSection })), { ssr: true });
const LazyUseCasesSection = dynamic(() => import('@/components/home/sections/use-cases-section').then(mod => ({ default: mod.UseCasesSection })), { ssr: true });
const LazyPricingSection = dynamic(() => import('@/components/home/sections/pricing-section').then(mod => ({ default: mod.PricingSection })), { ssr: true });
const LazyHeroVideoSection = dynamic(() => import('@/components/home/sections/hero-video-section').then(mod => ({ default: mod.HeroVideoSection })), { ssr: true });
const LazyCTASection = dynamic(() => import('@/components/home/sections/cta-section').then(mod => ({ default: mod.CTASection })), { ssr: true });
const LazyFooterSection = dynamic(() => import('@/components/home/sections/footer-section').then(mod => ({ default: mod.FooterSection })), { ssr: true });

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
            <LazyMadeInIndiaSection />
            <LazyOpenSourceSection />
            <LazyUseCasesSection />
            <div className='flex flex-col items-center px-4'>
              <LazyPricingSection />
            </div>
            <div className="pb-10 mx-auto">
              <LazyHeroVideoSection />
            </div>
            <LazyCTASection />
            <LazyFooterSection />
          </div>
        </main>
      </BackgroundAALChecker>
    </>
  );
}

