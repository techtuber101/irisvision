'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedLoadingTextProps {
  messages: string[];
  className?: string;
  interval?: number;
}

export const AnimatedLoadingText: React.FC<AnimatedLoadingTextProps> = ({
  messages,
  className,
  interval = 2000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setIsVisible(false);
      
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % messages.length);
        setIsVisible(true);
      }, 300); // Half of the fade duration
    }, interval);

    return () => clearInterval(cycleInterval);
  }, [messages.length, interval]);

  return (
    <span
      className={cn(
        "transition-opacity duration-300 ease-in-out",
        isVisible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {messages[currentIndex]}
    </span>
  );
};
