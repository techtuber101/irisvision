'use client';

import React from 'react';
import { Sparkles, Brain, Zap, BookOpen, Settings, Lightbulb, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PersonalityIntroSectionProps {
  onGetStarted?: () => void;
  className?: string;
}

export const PersonalityIntroSection: React.FC<PersonalityIntroSectionProps> = ({ 
  onGetStarted,
  className 
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Hero Section */}
      <div className="text-center space-y-4 pb-6 border-b border-white/10 dark:border-white/10">
        <div className="inline-flex items-center justify-center rounded-full bg-white/10 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 p-4 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">
          What are Personalities?
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Personalities are custom AI agents that give Iris different behaviors, capabilities, and ways of thinking. 
          Each personality can have its own instructions, tools, and knowledge base.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="relative rounded-2xl border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.15)] dark:bg-[rgba(10,14,22,0.4)] backdrop-blur-xl p-6 hover:scale-[1.02] transition-transform">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 flex-shrink-0">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Custom Instructions</h3>
              <p className="text-sm text-muted-foreground">
                Define how your personality thinks, responds, and behaves in conversations.
              </p>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.15)] dark:bg-[rgba(10,14,22,0.4)] backdrop-blur-xl p-6 hover:scale-[1.02] transition-transform">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 flex-shrink-0">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Powerful Tools</h3>
              <p className="text-sm text-muted-foreground">
                Enable specific capabilities like web search, code execution, file operations, and more.
              </p>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.15)] dark:bg-[rgba(10,14,22,0.4)] backdrop-blur-xl p-6 hover:scale-[1.02] transition-transform">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 flex-shrink-0">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Knowledge Base</h3>
              <p className="text-sm text-muted-foreground">
                Upload documents and files to give your personality specialized knowledge.
              </p>
            </div>
          </div>
        </div>

        <div className="relative rounded-2xl border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.15)] dark:bg-[rgba(10,14,22,0.4)] backdrop-blur-xl p-6 hover:scale-[1.02] transition-transform">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 flex-shrink-0">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Integrations</h3>
              <p className="text-sm text-muted-foreground">
                Connect to external services and APIs to extend your personality's capabilities.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Example Use Cases */}
      <div className="relative rounded-2xl border border-white/10 dark:border-white/10 bg-[rgba(255,255,255,0.15)] dark:bg-[rgba(10,14,22,0.4)] backdrop-blur-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <h3 className="font-semibold text-foreground">Example Use Cases</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground ml-8">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Code Assistant:</strong> A personality specialized in programming with access to code execution tools</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Research Analyst:</strong> A personality that excels at web research and data analysis</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Creative Writer:</strong> A personality with a creative writing style and access to your writing samples</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span><strong className="text-foreground">Customer Support:</strong> A personality trained on your product documentation to help customers</span>
          </li>
        </ul>
      </div>

      {onGetStarted && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

