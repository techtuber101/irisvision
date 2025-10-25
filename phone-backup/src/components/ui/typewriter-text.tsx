'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TypewriterTextProps {
  text: string;
  speed?: number; // milliseconds per character
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean;
  cursorBlinkSpeed?: number;
}

export function TypewriterText({
  text,
  speed = 50, // Default 50ms per character for rapid typing
  className = '',
  onComplete,
  showCursor = true,
  cursorBlinkSpeed = 500,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete, isComplete]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
    setIsComplete(false);
  }, [text]);

  return (
    <div className={`inline-flex items-center ${className}`}>
      <span>{displayedText}</span>
      {showCursor && (
        <motion.span
          className="ml-0.5 w-0.5 h-4 bg-current inline-block"
          animate={{ opacity: [1, 0, 1] }}
          transition={{
            duration: cursorBlinkSpeed / 1000,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </div>
  );
}

// Enhanced version with smooth character reveal animation
interface SmoothTypewriterTextProps extends TypewriterTextProps {
  staggerDelay?: number; // Delay between character animations
  characterAnimation?: 'fade' | 'slide' | 'scale';
}

export function SmoothTypewriterText({
  text,
  speed = 50,
  className = '',
  onComplete,
  showCursor = true,
  cursorBlinkSpeed = 500,
  staggerDelay = 20,
  characterAnimation = 'fade',
}: SmoothTypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete, isComplete]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
    setIsComplete(false);
  }, [text]);

  const getCharacterAnimation = (index: number) => {
    const baseDelay = index * staggerDelay / 1000;
    
    switch (characterAnimation) {
      case 'slide':
        return {
          initial: { y: 10, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { delay: baseDelay, duration: 0.1 }
        };
      case 'scale':
        return {
          initial: { scale: 0, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { delay: baseDelay, duration: 0.1 }
        };
      case 'fade':
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { delay: baseDelay, duration: 0.1 }
        };
    }
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      {displayedText.split('').map((char, index) => (
        <motion.span
          key={index}
          {...getCharacterAnimation(index)}
        >
          {char}
        </motion.span>
      ))}
      {showCursor && (
        <motion.span
          className="ml-0.5 w-0.5 h-4 bg-current inline-block"
          animate={{ opacity: [1, 0, 1] }}
          transition={{
            duration: cursorBlinkSpeed / 1000,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      )}
    </div>
  );
}
