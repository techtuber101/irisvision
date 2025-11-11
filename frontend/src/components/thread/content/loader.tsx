import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';

const items = [
    { id: 1, content: "Initialising Intelligence..." },
    { id: 2, content: "Understanding The Vision..." },
    { id: 3, content: "Enhancing The Vision..." },
    { id: 4, content: "Mapping conceptual landscapes..." },
    { id: 5, content: "Forging intelligent connections..." },
    { id: 6, content: "Crafting elegant solutions..." },
    { id: 7, content: "Navigating knowledge domains..." },
    { id: 8, content: "Illuminating hidden patterns..." },
    { id: 9, content: "Transcending complexity..." },
    { id: 10, content: "Elevating understanding..." },
    { id: 11, content: "Converging insights..." },
    { id: 12, content: "Transforming ideas into action..." },
    { id: 13, content: "Unveiling possibilities..." },
    { id: 14, content: "Channeling creative intelligence..." },
    { id: 15, content: "Distilling essence from chaos..." },
    { id: 16, content: "Bridging concepts and reality..." },
    { id: 17, content: "Amplifying cognitive resonance..." },
    { id: 18, content: "Curating knowledge streams..." },
    { id: 19, content: "Sculpting intelligent narratives..." },
    { id: 20, content: "Unlocking potential pathways..." },
    { id: 21, content: "Radiating clarity..." },
    { id: 22, content: "Converging wisdom streams..." },
    { id: 23, content: "Manifesting excellence..." },
    { id: 24, content: "Transcending boundaries..." }
  ];

export const AgentLoader = () => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((state) => {
        if (state >= items.length - 1) return 0;
        return state + 1;
      });
    }, 300);
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
              key={items[index].id}
              initial={{ y: 10, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -10, opacity: 0, filter: "blur(4px)" }}
              transition={{ ease: "easeInOut", duration: 0.12 }}
              className="absolute left-0 top-0"
          >
              <AnimatedShinyText className='text-xs whitespace-nowrap'>{items[index].content}</AnimatedShinyText>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

