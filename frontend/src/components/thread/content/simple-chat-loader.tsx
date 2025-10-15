import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';

const simpleChatItems = [
    { id: 1, content: "Processing your message..." },
    { id: 2, content: "Generating response..." },
    { id: 3, content: "Thinking..." },
    { id: 4, content: "Preparing answer..." },
    { id: 5, content: "Almost ready..." }
];

export const SimpleChatLoader = () => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((state) => {
        if (state >= simpleChatItems.length - 1) return 0;
        return state + 1;
      });
    }, 400); // Slightly slower than agent loader for a more relaxed feel
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex py-2 items-center w-full gap-3">
      <div className="flex items-center gap-1">
        <div className="h-1 w-1 rounded-full bg-primary/40 animate-pulse duration-400" />
        <div className="h-1 w-1 rounded-full bg-primary/40 animate-pulse duration-400 delay-100" />
        <div className="h-1 w-1 rounded-full bg-primary/40 animate-pulse duration-400 delay-200" />
      </div>
      <div className="relative flex-1 h-7">
        <AnimatePresence mode="wait">
          <motion.div
              key={simpleChatItems[index].id}
              initial={{ y: 10, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -10, opacity: 0, filter: "blur(4px)" }}
              transition={{ ease: "easeInOut", duration: 0.12 }}
              className="absolute left-0 top-0"
          >
              <AnimatedShinyText className='text-xs whitespace-nowrap'>{simpleChatItems[index].content}</AnimatedShinyText>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

