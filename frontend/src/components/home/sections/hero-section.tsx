"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

// -----------------------------
// Local storage for tiny chat
// -----------------------------
function useLocalMessages(storageKey: string, initial: ChatMessage[]) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" && window.localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch {}
  }, [messages, storageKey]);

  return { messages, setMessages } as const;
}

// -----------------------------
// Glass primitives (match site)
// -----------------------------
const baseGlass =
  "relative rounded-3xl border border-white/10 bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden";

function GlassCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`${baseGlass} ${className}`}>
      {/* Gradient rim (subtle) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))",
          WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
          WebkitMaskComposite: "xor" as any,
          maskComposite: "exclude",
          padding: 1,
          borderRadius: 24,
        }}
      />
      {/* Specular streak */}
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
      {/* Fine noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\'/><feColorMatrix type=\'saturate\' values=\'0\'/><feComponentTransfer><feFuncA type=\'table\' tableValues=\'0 0.03\'/></feComponentTransfer></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\' /></svg>')",
          backgroundSize: "100px 100px",
          mixBlendMode: "overlay",
        }}
      />
      {children}
    </div>
  );
}

function ChatBubble({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    onSend(t);
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Input area - wrapped in GlassCard */}
      <GlassCard>
        <div className="p-4">
          <form onSubmit={submit} className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                aria-label="Ask Iris"
                placeholder="Ask Iris anything…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-10 rounded-2xl border-0 bg-transparent px-4 text-sm placeholder:text-white/40 outline-none ring-0 focus:outline-none transition-all duration-200"
              />
            </div>
            <button
              type="submit"
              disabled={!text.trim()}
              className="h-10 rounded-2xl border border-white/20 bg-white/10 px-6 text-sm font-medium text-white/90 transition-all duration-200 hover:border-white/30 hover:bg-white/15 active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      </GlassCard>
    </div>
  );
}

// -----------------------------
// Main component
// -----------------------------
type HeroProps = {
  title?: string;
  product?: string;
  subhead?: string;
  irisTitle?: string;
  storageKey?: string;
  /** Optional: override the destination after capturing pending prompt */
  returnUrl?: string; // default "/dashboard"
};

const PENDING_PROMPT_KEY = "pendingAgentPrompt";

const HeroSection: React.FC<HeroProps> = ({
  title = "Iris",
  product = "Introducing",
  subhead = "The world's best agentic AI",
  irisTitle = "Iris",
  storageKey = "iris.chat",
  returnUrl = "/dashboard",
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [virtualScroll, setVirtualScroll] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [pauseComplete, setPauseComplete] = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  // Array of phrases that change after "The Intelligence that"
  const phrases = [
    "creates for you",
    "creates stunning slides",
    "builds complete websites.",
    "researches like experts.",
    "generates vivid images.",
    "codes autonomously",
    "automates spreadsheets.",
    "brings ideas alive.",
    "executes your vision",
  ];

  // Rotate phrases every 1.3 seconds after animation completes
  useEffect(() => {
    if (animationComplete) {
      const interval = setInterval(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
      }, 1300);

      return () => clearInterval(interval);
    }
  }, [animationComplete, phrases.length]);

  // Auto-expand after 6 seconds if user hasn't scrolled
  useEffect(() => {
    const autoExpandTimer = setTimeout(() => {
      if (!userHasScrolled && !animationComplete) {
        // Smoothly animate to fully expanded state
        const startTime = Date.now();
        const duration = 2000; // 2 second animation
        const targetScroll = 500;

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease-in-out function for smooth animation
          const easeInOutCubic = (t: number) => 
            t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          
          const newScroll = targetScroll * easeInOutCubic(progress);
          setVirtualScroll(newScroll);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Animation complete
            setAnimationComplete(true);
            setTimeout(() => {
              setPauseComplete(true);
            }, 1000);
          }
        };

        requestAnimationFrame(animate);
      }
    }, 6000); // 6 seconds delay

    return () => clearTimeout(autoExpandTimer);
  }, [userHasScrolled, animationComplete]);

  useEffect(() => {
    let scrollAccumulator = 0;
    const maxVirtualScroll = 500; // 500px for the text animation

    const handleWheel = (e: WheelEvent) => {
      // Mark that user has manually scrolled
      if (!userHasScrolled) {
        setUserHasScrolled(true);
      }

      // Block scrolling if animation is not complete OR if we're in the 1-second pause
      if (!animationComplete || (animationComplete && !pauseComplete)) {
        e.preventDefault();
        
        // Only accumulate scroll if animation isn't complete yet
        if (!animationComplete) {
          scrollAccumulator += e.deltaY;
          const newVirtualScroll = Math.max(0, Math.min(scrollAccumulator, maxVirtualScroll));
          setVirtualScroll(newVirtualScroll);
          
          // Mark animation as complete when we reach the end
          if (newVirtualScroll >= maxVirtualScroll && !animationComplete) {
            setAnimationComplete(true);
            // Start 1-second pause
            setTimeout(() => {
              setPauseComplete(true);
            }, 1000);
          }
        }
      }
    };

    const heroElement = heroRef.current;
    if (heroElement) {
      heroElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (heroElement) {
        heroElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [animationComplete, pauseComplete, userHasScrolled]);

  // Track scroll position for traveling spotlight
  useEffect(() => {
    const handleScroll = () => {
      if (pauseComplete) {
        setScrollPosition(window.scrollY);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pauseComplete]);

  // Calculate scroll progress (0 to 1) for the text animation
  const scrollProgress = Math.min(virtualScroll / 500, 1);
  
  // Text changes at 50% scroll progress
  const showNewText = scrollProgress > 0.5;
  
  // Calculate transformations
  const translateY = scrollProgress * 20; // Very slight downward movement (20px max)
  const scale = 1 + (scrollProgress * 0.8); // Scale from 1x to 1.8x (reduced from 2.5x)
  
  // Smooth fade transitions for text swap
  const oldTextOpacity = showNewText ? 0 : 1;
  const newTextOpacity = showNewText ? (scrollProgress - 0.5) * 2 : 0; // Fade in after 50%
  
  // Gradually adjust spacing during scroll (not suddenly)
  const textMarginTop = 16 + (scrollProgress * 24); // From 16px to 40px
  const cardMarginTop = 48 + (scrollProgress * 32); // From 48px to 80px

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PENDING_PROMPT_KEY, trimmed);
      }
      const to = user ? returnUrl : `/auth?mode=signin&returnUrl=${encodeURIComponent(returnUrl)}`;
      router.push(to);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <section ref={heroRef} id="hero" className="relative w-full overflow-hidden text-white" style={{ minHeight: animationComplete ? '92vh' : '100vh' }}>
      {/* very soft local halo to keep hero focus without duplicating the global spotlight */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[700px] blur-[180px] opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(120,160,255,0.22) 0%, rgba(120,160,255,0.215) 3%, rgba(120,160,255,0.21) 6%, rgba(120,160,255,0.205) 9%, rgba(120,160,255,0.20) 12%, rgba(120,160,255,0.19) 15%, rgba(120,160,255,0.18) 18%, rgba(120,160,255,0.17) 21%, rgba(120,160,255,0.16) 24%, rgba(120,160,255,0.15) 27%, rgba(120,160,255,0.14) 30%, rgba(120,160,255,0.13) 33%, rgba(120,160,255,0.12) 36%, rgba(120,160,255,0.11) 39%, rgba(120,160,255,0.10) 42%, rgba(120,160,255,0.09) 45%, rgba(120,160,255,0.08) 48%, rgba(120,160,255,0.07) 52%, rgba(120,160,255,0.06) 56%, rgba(120,160,255,0.05) 60%, rgba(120,160,255,0.04) 64%, rgba(120,160,255,0.035) 68%, rgba(120,160,255,0.03) 72%, rgba(120,160,255,0.025) 76%, rgba(120,160,255,0.02) 80%, rgba(120,160,255,0.015) 84%, rgba(120,160,255,0.01) 88%, rgba(120,160,255,0.006) 92%, rgba(120,160,255,0.003) 96%, transparent 100%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Traveling spotlight that moves down with scroll - thin rectangular beam with gradual fade-in */}
      {(animationComplete || scrollProgress > 0) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-[1200px] blur-[150px]"
          style={{
            top: `${400 + scrollPosition}px`, // Start from above chat input area and move with scroll
            opacity: pauseComplete ? 0.75 : scrollProgress * 0.75, // Fade in during animation, full opacity after
            background:
              "radial-gradient(ellipse 15% 60% at 50% 0%, rgba(120,160,255,0.70) 0%, rgba(120,160,255,0.685) 2%, rgba(120,160,255,0.67) 4%, rgba(120,160,255,0.655) 6%, rgba(120,160,255,0.64) 8%, rgba(120,160,255,0.625) 10%, rgba(120,160,255,0.61) 12%, rgba(120,160,255,0.595) 14%, rgba(120,160,255,0.58) 16%, rgba(120,160,255,0.565) 18%, rgba(120,160,255,0.55) 20%, rgba(120,160,255,0.53) 22%, rgba(120,160,255,0.51) 24%, rgba(120,160,255,0.49) 26%, rgba(120,160,255,0.47) 28%, rgba(120,160,255,0.45) 30%, rgba(120,160,255,0.43) 32%, rgba(120,160,255,0.41) 34%, rgba(120,160,255,0.39) 36%, rgba(120,160,255,0.37) 38%, rgba(120,160,255,0.35) 40%, rgba(120,160,255,0.33) 42%, rgba(120,160,255,0.31) 44%, rgba(120,160,255,0.29) 46%, rgba(120,160,255,0.27) 48%, rgba(120,160,255,0.25) 50%, rgba(120,160,255,0.23) 52%, rgba(120,160,255,0.21) 54%, rgba(120,160,255,0.19) 56%, rgba(120,160,255,0.17) 58%, rgba(120,160,255,0.15) 60%, rgba(120,160,255,0.135) 62%, rgba(120,160,255,0.12) 64%, rgba(120,160,255,0.105) 66%, rgba(120,160,255,0.09) 68%, rgba(120,160,255,0.08) 70%, rgba(120,160,255,0.07) 72%, rgba(120,160,255,0.06) 74%, rgba(120,160,255,0.05) 76%, rgba(120,160,255,0.042) 78%, rgba(120,160,255,0.035) 80%, rgba(120,160,255,0.028) 82%, rgba(120,160,255,0.022) 84%, rgba(120,160,255,0.017) 86%, rgba(120,160,255,0.013) 88%, rgba(120,160,255,0.009) 90%, rgba(120,160,255,0.006) 92%, rgba(120,160,255,0.004) 94%, rgba(120,160,255,0.002) 96%, rgba(120,160,255,0.001) 98%, transparent 100%)",
            mixBlendMode: "screen",
            transition: pauseComplete ? 'opacity 0.3s ease-out' : 'none',
          }}
        />
      )}

      {/* Content container */}
      <div className="relative mx-auto flex h-screen max-w-6xl flex-col items-center justify-center px-6 py-24">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-2 text-sm/6 text-white/70"
        >
          {product}
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-center text-7xl font-semibold tracking-tight text-transparent md:text-8xl"
        >
          {title}
        </motion.h1>

        {/* Subhead - with scroll effect and entry animation */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div 
            className="max-w-2xl text-balance text-center text-lg text-white/70 font-semibold"
            style={{
              transform: `translateY(${translateY}px) scale(${scale})`,
              transformOrigin: 'center center',
              fontWeight: 500 + (scrollProgress * 100), // Gradually increase weight from 500 to 600
              marginTop: `${textMarginTop}px`, // Gradually increases during scroll
            }}
          >
          <div 
            style={{
              opacity: oldTextOpacity,
              transition: 'opacity 0.4s ease-out',
              position: showNewText ? 'absolute' : 'relative',
              inset: 0,
            }}
          >
            {subhead}
          </div>
          <div 
            style={{
              opacity: newTextOpacity,
              transition: 'opacity 0.4s ease-out',
              position: showNewText ? 'relative' : 'absolute',
              inset: 0,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '0.3em',
            }}
          >
            <span>The Intelligence that</span>
            <span 
              key={currentPhraseIndex}
              style={{
                animation: animationComplete ? 'slideUpFade 1.3s ease-in-out' : 'none',
                display: 'inline-block',
              }}
            >
              {phrases[currentPhraseIndex].split('').map((char, index) => (
                <span
                  key={index}
                  className="glow-letter"
                  style={{
                    animationDelay: animationComplete ? `${index * 0.03}s` : '0s',
                    display: 'inline-block',
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </span>
          </div>
          </div>
        </motion.div>
        
        {/* CSS animation for sliding fade effect and letter glow */}
        <style jsx>{`
          @keyframes slideUpFade {
            0% {
              opacity: 0;
              transform: translateY(20px);
            }
            10% {
              opacity: 1;
              transform: translateY(0);
            }
            90% {
              opacity: 1;
              transform: translateY(0);
            }
            100% {
              opacity: 0;
              transform: translateY(-20px);
            }
          }

          @keyframes letterGlow {
            0% {
              color: rgba(255, 255, 255, 0.7);
              filter: brightness(1);
            }
            50% {
              color: rgba(255, 255, 255, 1);
              filter: brightness(1.8);
            }
            100% {
              color: rgba(255, 255, 255, 0.7);
              filter: brightness(1);
            }
          }

          .glow-letter {
            animation: letterGlow 1s ease-in-out;
            color: rgba(255, 255, 255, 0.7);
          }
        `}</style>

        {/* Card stack */}
        <div 
          className="relative w-full max-w-6xl"
          style={{ marginTop: `${cardMarginTop}px` }}
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-6">
            {/* Left placeholder card */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              whileHover={{ 
                y: -12, 
                scale: 1.02,
                zIndex: 50,
                transition: { duration: 0.4, ease: "easeOut" }
              }}
              className="hidden pointer-events-auto cursor-pointer group"
            >
              <GlassCard className="transition-all duration-400 group-hover:shadow-[0_20px_60px_-8px_rgba(0,0,0,0.8)] group-hover:ring-1 group-hover:ring-blue-400/20 group-hover:opacity-95">
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-white/10 ring-1 ring-white/15" />
                    <div className="h-3 w-28 rounded bg-white/10" />
                  </div>
                  <PlaceholderCard direction="left" />
                </div>
              </GlassCard>
            </motion.div>

            {/* Center interactive chat card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="relative z-10 mx-auto w-[92%] md:w-[75%] p-0"
            >
              <div className="space-y-4">
                {/* Input box only */}
                <ChatBubble 
                  onSend={handleSend}
                />
              </div>
            </motion.div>

            {/* Right placeholder card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.38 }}
              whileHover={{ 
                y: -12, 
                scale: 1.02,
                zIndex: 50,
                transition: { duration: 0.4, ease: "easeOut" }
              }}
              className="hidden w-full md:w-[24%] pointer-events-auto cursor-pointer group"
            >
              <GlassCard className="transition-all duration-400 group-hover:shadow-[0_20px_60px_-8px_rgba(0,0,0,0.8)] group-hover:ring-1 group-hover:ring-green-400/20 group-hover:opacity-95">
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-white/10 ring-1 ring-white/15" />
                    <div className="h-3 w-28 rounded bg-white/10" />
                  </div>
                  <PlaceholderCard direction="right" />
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

function PlaceholderCard({ direction }: { direction: "left" | "right" }) {
  if (direction === "left") {
    return (
      <div className="pointer-events-none select-none opacity-90">
        {/* Create Card - What Iris Can Create */}
        <div className="mb-4 flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 ring-1 ring-blue-400/30 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm font-medium text-blue-300/80">What Iris Can Create</span>
        </div>
        
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
            <span className="text-xs text-blue-300/80">Documents</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
            <span className="text-xs text-blue-300/80">Websites</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
            <span className="text-xs text-blue-300/80">Presentations</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
            <span className="text-xs text-blue-300/80">Images</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
            <span className="text-xs text-blue-300/80">Apps</span>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
            <span className="text-xs text-blue-300/80">Reports</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none select-none opacity-90">
      {/* Execute Card - Real Content */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-green-400/20 to-emerald-400/20 ring-1 ring-green-400/30 flex items-center justify-center">
          <svg className="w-3 h-3 text-green-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-sm font-medium text-green-300/80">Execute</span>
      </div>
      
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 ring-1 ring-green-400/20">
          <div className="text-xs text-green-200/70 font-medium mb-1">Rigorous Analysis</div>
          <div className="text-xs text-green-300/60">I will deep analyze the market to provide best possible insights.</div>
        </div>
        <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 ring-1 ring-green-400/20">
          <div className="text-xs text-green-200/70 font-medium mb-1">Autonomous, Seamless Execution</div>
          <div className="text-xs text-green-300/60">I have completed every single task, delivering results.</div>
        </div>
      </div>
      
      <div className="mt-4 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-400/60 animate-pulse" />
        <span className="text-xs text-green-300/70 font-medium">Analyze → Execute</span>
      </div>
    </div>
  );
}

export default HeroSection;
export { HeroSection };

