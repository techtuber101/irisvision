'use client';

import { cn } from '@/lib/utils';
// import { useEffect, useState } from 'react';

const TEXT = 'Thinking';
const LETTER_DELAY_INCREMENT = 0.025; // Delay between letters

// COMMENTED OUT: 5x5 grid patterns (0-24 positions, row-major order)
//  0  1  2  3  4
//  5  6  7  8  9
// 10 11 12 13 14
// 15 16 17 18 19
// 20 21 22 23 24
// const PATTERNS = {
//   heart: [2, 6, 7, 8, 10, 11, 12, 13, 14, 16, 17, 18, 22], // Heart shape
//   circle: [1, 2, 3, 5, 9, 10, 14, 15, 19, 21, 22, 23], // Circle outline
//   star: [2, 6, 7, 8, 10, 12, 14, 16, 17, 18, 22], // Star shape
//   plus: [2, 7, 10, 11, 12, 13, 14, 17, 22], // Plus sign
//   cross: [0, 4, 6, 8, 12, 16, 18, 20, 24], // Diagonal cross
//   square: [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24], // Square outline
//   center: [12], // Just center
//   corners: [0, 4, 20, 24], // Four corners
//   diamond: [2, 6, 7, 8, 11, 12, 13, 16, 17, 18, 22], // Diamond shape
// };
// const PATTERN_NAMES = Object.keys(PATTERNS);

interface ThinkingIndicatorProps {
  className?: string;
}

export function ThinkingIndicator({ className }: ThinkingIndicatorProps = {}) {
  // COMMENTED OUT: Grid pattern state
  // const [currentPattern, setCurrentPattern] = useState<string>('heart');
  // const [patternIndex, setPatternIndex] = useState(0);

  // COMMENTED OUT: Pattern cycling effect
  // useEffect(() => {
  //   // Cycle through patterns
  //   const interval = setInterval(() => {
  //     setPatternIndex((prev) => {
  //       const next = (prev + 1) % PATTERN_NAMES.length;
  //       setCurrentPattern(PATTERN_NAMES[next]);
  //       return next;
  //     });
  //   }, 2000); // Change pattern every 2 seconds
  //   return () => clearInterval(interval);
  // }, []);

  // COMMENTED OUT: Grid dots
  // const gridDots = Array.from({ length: 25 }, (_, i) => i);
  // const activePattern = PATTERNS[currentPattern as keyof typeof PATTERNS] || PATTERNS.heart;

  return (
    <span
      className={cn(
        'inline-flex items-center text-sm font-semibold text-neutral-900 dark:text-white',
        className,
      )}
    >
      {TEXT.split('').map((char, index) => (
        <span
          key={index}
          className="thinking-glow-letter"
          style={{
            animationDelay: `${index * LETTER_DELAY_INCREMENT}s`,
            display: 'inline-block',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
      <style jsx>{`
        @keyframes letterGlow {
          0% {
            color: rgba(255, 255, 255, 0.7);
            filter: brightness(1);
            opacity: 0.7;
          }
          50% {
            color: rgba(255, 255, 255, 0.95);
            filter: brightness(1.3);
            opacity: 0.9;
          }
          100% {
            color: rgba(255, 255, 255, 0.7);
            filter: brightness(1);
            opacity: 0.7;
          }
        }

        .thinking-glow-letter {
          animation: letterGlow 0.7s ease-in-out infinite;
          color: rgba(255, 255, 255, 0.7);
        }

        /* COMMENTED OUT: 5x5 Grid styles */
        /* .thinking-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          grid-template-rows: repeat(5, 1fr);
          gap: 1.5px;
          width: 28px;
          height: 28px;
          position: relative;
        }

        .thinking-grid-dot {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .thinking-grid-dot-inner {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.3);
          transition: all 0.3s ease;
        }

        .thinking-grid-dot-active .thinking-grid-dot-inner {
          background-color: rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.6),
                      0 0 12px rgba(255, 255, 255, 0.4);
          animation: neuronPulse 1.5s ease-in-out infinite;
          transform: scale(1.2);
        }

        @keyframes neuronPulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.8);
            filter: brightness(1);
          }
          25% {
            opacity: 0.7;
            transform: scale(1.1);
            filter: brightness(1.2);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
            filter: brightness(1.4);
          }
          75% {
            opacity: 0.7;
            transform: scale(1.1);
            filter: brightness(1.2);
          }
        }

        .thinking-grid-dot-active {
          animation: neuronFloat 3s ease-in-out infinite;
        }

        @keyframes neuronFloat {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-1px) translateX(0.5px);
          }
          50% {
            transform: translateY(0.5px) translateX(-0.5px);
          }
          75% {
            transform: translateY(-0.5px) translateX(0.5px);
          }
        }

        :global(.light) .thinking-grid-dot-inner {
          background-color: rgba(0, 0, 0, 0.3);
        }

        :global(.light) .thinking-grid-dot-active .thinking-grid-dot-inner {
          background-color: rgba(0, 0, 0, 0.9);
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.6),
                      0 0 12px rgba(0, 0, 0, 0.4);
        } */

        :global(.light) .thinking-glow-letter {
          color: rgba(0, 0, 0, 0.7);
          animation: letterGlowLight 0.7s ease-in-out infinite;
        }

        @keyframes letterGlowLight {
          0% {
            color: rgba(0, 0, 0, 0.7);
            filter: brightness(1);
            opacity: 0.7;
          }
          50% {
            color: rgba(0, 0, 0, 0.95);
            filter: brightness(1.3);
            opacity: 0.9;
          }
          100% {
            color: rgba(0, 0, 0, 0.7);
            filter: brightness(1);
            opacity: 0.7;
          }
        }
      `}</style>
    </span>
  );
}
