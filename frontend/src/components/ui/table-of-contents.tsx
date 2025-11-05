'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';

interface TableOfContentsProps {
  className?: string;
}

interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ className }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const pathname = usePathname();

  const getHeadings = useCallback(() => {
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingItems: HeadingItem[] = [];

    headingElements.forEach((heading) => {
      // Skip headings in the sidebar or header
      const isInSidebar = heading.closest('[data-sidebar]') !== null;
      const isInHeader = heading.closest('header') !== null;
      const isInFooter = heading.closest('footer') !== null;
      
      if (isInSidebar || isInHeader || isInFooter) {
        return;
      }

      // Auto-generate ID if heading doesn't have one
      if (!heading.id) {
        const text = heading.textContent || '';
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        heading.id = id;
      }
      
      if (heading.id) {
        headingItems.push({
          id: heading.id,
          text: heading.textContent || '',
          level: parseInt(heading.tagName.charAt(1)),
        });
      }
    });

    return headingItems;
  }, []);

  useEffect(() => {
    const updateHeadings = () => {
      const newHeadings = getHeadings();
      setHeadings(newHeadings);
      if (newHeadings.length > 0) {
        setActiveId(newHeadings[0].id);
      } else {
        setActiveId('');
      }
    };
    
    // Wait for DOM to be ready
    if (document.readyState === 'complete') {
      updateHeadings();
    } else {
      window.addEventListener('load', updateHeadings);
    }
    
    const timeout = setTimeout(updateHeadings, 300);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('load', updateHeadings);
    };
  }, [getHeadings, pathname]);

  useEffect(() => {
    if (headings.length === 0) return;
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const offset = Math.min(windowHeight * 0.2, 100);
      let activeHeading = headings[0];
      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i];
        const element = document.getElementById(heading.id);
        
        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = scrollY + rect.top;
          if (elementTop <= scrollY + offset) {
            activeHeading = heading;
            break;
          }
        }
      }
      setActiveId(activeHeading.id);
    };
    handleScroll();
    let rafId: number;
    const throttledScroll = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(handleScroll);
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      window.removeEventListener('resize', handleScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [headings, pathname]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const windowHeight = window.innerHeight;
      const offset = Math.min(windowHeight * 0.15, 80);
      
      const elementTop = element.getBoundingClientRect().top + window.scrollY;
      const targetPosition = elementTop - offset;
      
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
      setActiveId(id);
    }
  };

  if (headings.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Menu className="w-4 h-4" />
        <h4 className="font-semibold text-foreground">What's on this page</h4>
      </div>
      
      <nav className="space-y-1">
        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => scrollToSection(heading.id)}
            className={cn(
              'mb-1 block w-full text-left text-sm transition-all duration-200 py-1 px-3 hover:text-accent-foreground rounded-md',
              activeId === heading.id
                ? 'text-primary font-semibold border-l-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground',
              heading.level === 2 && 'pl-3',
              heading.level === 3 && 'pl-6',
              heading.level === 4 && 'pl-9',
              heading.level >= 5 && 'pl-12'
            )}
          >
            {heading.text}
          </button>
        ))}
      </nav>
    </div>
  );
} 