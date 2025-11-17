"use client";

import React, { useEffect, useState, useRef } from "react";
import { SectionHeader } from "@/components/home/section-header";
import { motion } from "motion/react";
import { Shield, Server, Lock, Flag } from "lucide-react";
import { Marquee } from "@/components/home/ui/marquee";

// ==============================
// Glass primitives
// ==============================
const baseGlass =
  "relative rounded-3xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden";

function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${baseGlass} ${className}`}>
      {/* Rim */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))",
          WebkitMask:
            "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
          WebkitMaskComposite: "xor" as any,
          maskComposite: "exclude",
          padding: 1,
          borderRadius: 24,
        }}
      />
      {/* Streak */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)",
          filter: "blur(6px)",
          mixBlendMode: "screen",
        }}
      />
      {children}
    </div>
  );
}

// ==============================
// Section
// ==============================
export function MadeInIndiaSection() {
  const [scrollY, setScrollY] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const [sectionTop, setSectionTop] = useState(0);

  useEffect(() => {
    // Get section position
    const updateSectionPosition = () => {
      if (sectionRef.current) {
        setSectionTop(sectionRef.current.offsetTop);
      }
    };

    updateSectionPosition();

    // Track scroll
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    // Update position on resize
    window.addEventListener('resize', updateSectionPosition);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('resize', updateSectionPosition);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Calculate spotlight opacity based on scroll position
  // Traveling beam from hero starts at ~400px and moves with scroll
  // It hits Made in India section when: 400 + scrollY ≈ sectionTop
  // We want spotlight to appear when beam arrives and fade out as we continue scrolling
  const beamPosition = 400 + scrollY; // Position of traveling beam
  const distanceToSection = beamPosition - sectionTop;
  
  // Spotlight appears when beam is within 300px of section top
  // Fades in from -300 to 0, stays visible from 0 to +200, then fades out from +200 to +500
  let spotlightOpacity = 0;
  if (distanceToSection >= -300 && distanceToSection <= 0) {
    // Fade in as beam approaches
    spotlightOpacity = (distanceToSection + 300) / 300;
  } else if (distanceToSection > 0 && distanceToSection <= 200) {
    // Full brightness when beam hits
    spotlightOpacity = 1;
  } else if (distanceToSection > 200 && distanceToSection <= 500) {
    // Fade out as we scroll past
    spotlightOpacity = 1 - ((distanceToSection - 200) / 300);
  }

  return (
    <section
      ref={sectionRef}
      id="made-in-india"
      className="relative flex flex-col items-center justify-center w-full pb-24 overflow-hidden"
    >
      {/* Dynamic spotlight that appears when traveling beam hits and fades out */}
      {spotlightOpacity > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ opacity: spotlightOpacity }}
        >
          <div
            className="absolute left-1/2 -top-[10%] -translate-x-1/2 w-full h-[60vh]"
            style={{
              background: "radial-gradient(ellipse 25% 35% at 50% 15%, rgba(120,160,255,0.35) 0%, rgba(120,160,255,0.25) 15%, rgba(120,160,255,0.18) 30%, rgba(120,160,255,0.12) 45%, rgba(120,160,255,0.08) 60%, rgba(120,160,255,0.04) 75%, transparent 100%)",
              mixBlendMode: "screen",
              filter: "blur(100px)",
            }}
          />
        </div>
      )}

      {/* Original static spotlight effect emanating from "Made in India" */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <motion.div
          className="absolute left-1/2 top-[8%] -translate-x-1/2 w-full h-[50vh]"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ 
            duration: 2.5, 
            ease: [0.22, 1, 0.36, 1],
            opacity: { duration: 2.8, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 2.2, ease: [0.25, 0.46, 0.45, 0.94] }
          }}
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 5%, rgba(120,160,255,0.1), rgba(120,160,255,0.06) 30%, rgba(120,160,255,0.03) 50%, transparent 70%)",
            mixBlendMode: "screen",
            filter: "blur(40px)",
          }}
        />
        {/* Additional softer spread */}
        <motion.div
          className="absolute left-1/2 top-[10%] -translate-x-1/2 w-full h-[45vh]"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ 
            duration: 3, 
            delay: 0.3,
            ease: [0.22, 1, 0.36, 1],
            opacity: { duration: 3.2, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 2.5, ease: [0.25, 0.46, 0.45, 0.94] }
          }}
          style={{
            background: "radial-gradient(ellipse 90% 60% at 50% 8%, rgba(173,216,255,0.08), rgba(173,216,255,0.05) 40%, transparent 70%)",
            mixBlendMode: "screen",
            filter: "blur(50px)",
          }}
        />
      </div>

      <div className="w-full max-w-6xl mx-auto px-6 relative z-10">
        <SectionHeader>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-center bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-6 relative z-20">
            Made in India
          </h2>
          <p className="text-xl md:text-2xl lg:text-3xl text-center text-white/80 font-medium whitespace-nowrap mb-4 relative z-20">
            The World's Most Secure Agentic Intelligence.
          </p>
          
        </SectionHeader>
        
        {/* Trust Badges Sliding Banner */}
        <div className="relative z-10 py-6 -mx-6 md:-mx-12 lg:-mx-24 xl:-mx-32 w-screen max-w-none" style={{ marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
          <Marquee pauseOnHover className="[--duration:40s] [--gap:2.5rem]">
            {/* MEITY Logo */}
            <div className="flex items-center justify-center h-16 w-32 mx-6 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <img 
                src="/trustbadges/meity.svg" 
                alt="MEITY" 
                className="h-10 w-auto object-contain brightness-0 invert opacity-100"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            
            {/* NITI Aayog Logo */}
            <div className="flex items-center justify-center h-16 w-32 mx-6 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <img 
                src="/trustbadges/nitiaayog.svg" 
                alt="NITI Aayog" 
                className="h-10 w-auto object-contain brightness-0 invert opacity-100"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            
            {/* Digital India Logo */}
            <div className="flex items-center justify-center h-16 w-32 mx-6 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <img 
                src="/trustbadges/Digital_India_logo.svg.png" 
                alt="Digital India" 
                className="h-10 w-auto object-contain filter brightness-0 invert opacity-80"
              />
            </div>
            
            {/* India AI Logo */}
            <div className="flex items-center justify-center h-16 w-32 mx-6 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <img 
                src="/trustbadges/indiaai.png" 
                alt="India AI" 
                className="h-10 w-auto object-contain filter brightness-0 invert opacity-80"
              />
            </div>
            
            {/* Trust Badge Image 1 */}
            <div className="flex items-center justify-center h-16 w-32 mx-6 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <img 
                src="/trustbadges/image.png" 
                alt="Trust Badge" 
                className="h-10 w-auto object-contain filter brightness-0 invert opacity-80"
              />
            </div>
            
            {/* Trust Badge Image 2 */}
            <div className="flex items-center justify-center h-16 w-32 mx-6 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <img 
                src="/trustbadges/image copy.png" 
                alt="Trust Badge" 
                className="h-10 w-auto object-contain filter brightness-0 invert opacity-80"
              />
            </div>
            
            {/* Trust Badge Image 3 */}
            <div className="flex items-center justify-center h-16 w-32 mx-6 px-4 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors">
              <img 
                src="/trustbadges/image-removebg-preview (1).png" 
                alt="Trust Badge" 
                className="h-10 w-auto object-contain filter brightness-0 invert opacity-80"
              />
            </div>
          </Marquee>
        </div>
        
        <div className="border-b w-full h-px mt-4"></div>

        {/* Stats grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            whileHover={{ y: -3 }}
            className="relative flex flex-col h-full"
          >
            <GlassCard className="p-8 flex flex-col items-center text-center gap-4 h-full">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 ring-1 ring-blue-400/30">
                <Server className="h-10 w-10 text-cyan-300" />
              </div>
              <div className="w-full flex flex-col flex-1">
                <div className="text-xs md:text-sm font-medium text-white/60 mb-2 uppercase tracking-wider min-h-[3rem] flex items-center justify-center">
                  Infrastructure in India
                </div>
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/80 bg-clip-text text-transparent mb-3">
                  100%
                </div>
                <p className="text-sm md:text-base text-white/70 leading-relaxed">
                  All code, servers, data, and storage hosted entirely within Indian borders—complete sovereignty
                </p>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            whileHover={{ y: -3 }}
            className="relative flex flex-col h-full"
          >
            <GlassCard className="p-8 flex flex-col items-center text-center gap-4 h-full">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 ring-1 ring-red-400/30">
                <Shield className="h-10 w-10 text-orange-300" />
              </div>
              <div className="w-full flex flex-col flex-1">
                <div className="text-xs md:text-sm font-medium text-white/60 mb-2 uppercase tracking-wider min-h-[3rem] flex items-center justify-center">
                  Foreign Dependency
                </div>
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/80 bg-clip-text text-transparent mb-3">
                  0%
                </div>
                <p className="text-sm md:text-base text-white/70 leading-relaxed">
                  Fully independent of international cloud providers and external infrastructure dependencies
                </p>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ y: -3 }}
            className="relative flex flex-col h-full"
          >
            <GlassCard className="p-8 flex flex-col items-center text-center gap-4 h-full">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 ring-1 ring-green-400/30">
                <Lock className="h-10 w-10 text-emerald-300" />
              </div>
              <div className="w-full flex flex-col flex-1">
                <div className="text-xs md:text-sm font-medium text-white/60 mb-2 uppercase tracking-wider min-h-[3rem] flex items-center justify-center">
                  Data Sovereignty
                </div>
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/80 bg-clip-text text-transparent mb-3">
                  Secured
                </div>
                <p className="text-sm md:text-base text-white/70 leading-relaxed">
                  Ensures complete data privacy, security, and compliance with India's regulatory framework
                </p>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ y: -3 }}
            className="relative flex flex-col h-full"
          >
            <GlassCard className="p-8 flex flex-col items-center text-center gap-4 h-full">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 ring-1 ring-orange-400/30">
                <Flag className="h-10 w-10 text-amber-300" />
              </div>
              <div className="w-full flex flex-col flex-1">
                <div className="text-xs md:text-sm font-medium text-white/60 mb-2 uppercase tracking-wider min-h-[3rem] flex items-center justify-center">
                  Made in India Alignment
                </div>
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/80 bg-clip-text text-transparent mb-3">
                  100%
                </div>
                <p className="text-sm md:text-base text-white/70 leading-relaxed">
                  Built, evolved, and deployed in India—supporting national vision for tech independence
                </p>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

