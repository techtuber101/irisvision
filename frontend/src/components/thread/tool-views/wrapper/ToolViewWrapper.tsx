import React from 'react';
import { ToolViewProps } from '../types';
import { formatTimestamp, getToolTitle } from '../utils';
import { getToolIcon } from '../../utils';
import { CircleDashed, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolViewWrapperProps extends ToolViewProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  showStatus?: boolean;
  customStatus?: {
    success?: string;
    failure?: string;
    streaming?: string;
  };
}

export function ToolViewWrapper({
  name = 'unknown',
  isSuccess = true,
  isStreaming = false,
  assistantTimestamp,
  toolTimestamp,
  children,
  headerContent,
  footerContent,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
  showStatus = true,
  customStatus,
}: ToolViewWrapperProps) {
  const toolTitle = getToolTitle(name);
  const Icon = getToolIcon(name);

  return (
    <div className={cn("flex flex-col h-full p-4 md:p-5", className)}>
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(7,10,17,0.95)] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-300">
        {/* Gradient rim */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{
          background: 'linear-gradient(180deg, rgba(173,216,255,0.10), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.10) 85%, rgba(255,255,255,0.06))',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px',
          borderRadius: '16px'
        }} />

        {/* Specular streak */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20" style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
          filter: 'blur(6px)',
          mixBlendMode: 'screen'
        }} />

        {/* Fine noise */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
          backgroundSize: '100px 100px',
          mixBlendMode: 'overlay'
        }} />

        <div className="relative flex h-full flex-col">
          {(headerContent || showStatus) && (
            <div className={cn(
              "mb-3 flex items-center justify-between",
              headerClassName
            )}>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
                  {Icon && <Icon className="h-3.5 w-3.5 text-white/90" />}
                </div>
                <h3 className="text-sm font-medium text-white/80">{toolTitle}</h3>
              </div>
              {headerContent}
            </div>
          )}

          <div className={cn("relative flex-1 overflow-y-auto rounded-xl", contentClassName)}>
            {children}
          </div>

          {(footerContent || showStatus) && (
            <div className={cn(
              "sticky bottom-0 mt-3 pt-3 border-t border-white/5",
              footerClassName
            )}>
              <div className="flex items-center justify-between text-xs text-white/70">
                {!isStreaming && showStatus && (
                  <div className="flex items-center gap-2">
                    {isSuccess ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    )}
                    <span>
                      {isSuccess
                        ? customStatus?.success || "Completed successfully"
                        : customStatus?.failure || "Execution failed"}
                    </span>
                  </div>
                )}

                {isStreaming && showStatus && (
                  <div className="flex items-center gap-2">
                    <CircleDashed className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                    <span>{customStatus?.streaming || "Processing..."}</span>
                  </div>
                )}

                <div className="text-xs text-white/60">
                  {toolTimestamp && !isStreaming
                    ? formatTimestamp(toolTimestamp)
                    : assistantTimestamp
                      ? formatTimestamp(assistantTimestamp)
                      : ""}
                </div>

                {footerContent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
