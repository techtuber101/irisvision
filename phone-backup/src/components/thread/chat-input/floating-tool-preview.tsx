import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircleDashed, Maximize2 } from 'lucide-react';
import { getToolIcon, getUserFriendlyToolName } from '@/components/thread/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ToolCallInput {
  assistantCall: {
    content?: string;
    name?: string;
    timestamp?: string;
  };
  toolResult?: {
    content?: string;
    isSuccess?: boolean;
    timestamp?: string;
  };
  messages?: any[];
}

interface FloatingToolPreviewProps {
  toolCalls: ToolCallInput[];
  currentIndex: number;
  onExpand: () => void;
  agentName?: string;
  isVisible: boolean;
  // Indicators for multiple notification types (not tool calls)
  showIndicators?: boolean;
  indicatorIndex?: number;
  indicatorTotal?: number;
  onIndicatorClick?: (index: number) => void;
}

const FLOATING_LAYOUT_ID = 'tool-panel-float';
const CONTENT_LAYOUT_ID = 'tool-panel-content';

const getToolResultStatus = (toolCall: any): boolean => {
  const content = toolCall?.toolResult?.content;
  if (!content) return toolCall?.toolResult?.isSuccess ?? true;

  const safeParse = (data: any) => {
    try { return typeof data === 'string' ? JSON.parse(data) : data; }
    catch { return null; }
  };

  const parsed = safeParse(content);
  if (!parsed) return toolCall?.toolResult?.isSuccess ?? true;

  if (parsed.content) {
    const inner = safeParse(parsed.content);
    if (inner?.tool_execution?.result?.success !== undefined) {
      return inner.tool_execution.result.success;
    }
  }
  const success = parsed.tool_execution?.result?.success ??
    parsed.result?.success ??
    parsed.success;

  return success !== undefined ? success : (toolCall?.toolResult?.isSuccess ?? true);
};

export const FloatingToolPreview: React.FC<FloatingToolPreviewProps> = ({
  toolCalls,
  currentIndex,
  onExpand,
  agentName,
  isVisible,
  showIndicators = false,
  indicatorIndex = 0,
  indicatorTotal = 1,
  onIndicatorClick,
}) => {
  const [isExpanding, setIsExpanding] = React.useState(false);
  const currentToolCall = toolCalls[currentIndex];
  const totalCalls = toolCalls.length;

  React.useEffect(() => {
    if (isVisible) {
      setIsExpanding(false);
    }
  }, [isVisible]);

  if (!currentToolCall || totalCalls === 0) return null;

  const toolName = currentToolCall.assistantCall?.name || 'Tool Call';
  const CurrentToolIcon = getToolIcon(toolName);
  const isStreaming = currentToolCall.toolResult?.content === 'STREAMING';
  const isSuccess = isStreaming ? true : getToolResultStatus(currentToolCall);

  const handleClick = () => {
    setIsExpanding(true);
    requestAnimationFrame(() => {
      onExpand();
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          layoutId={FLOATING_LAYOUT_ID}
          layout
          transition={{
            layout: {
              type: "spring",
              stiffness: 300,
              damping: 30
            }
          }}
          className="pb-3 w-full"
          style={{ pointerEvents: 'auto' }}
        >
          <motion.div
            layoutId={CONTENT_LAYOUT_ID}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] rounded-3xl p-2 w-full cursor-pointer group relative overflow-hidden"
            onClick={handleClick}
            style={{ opacity: isExpanding ? 0 : 1 }}
          >
            {/* Gradient rim */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl" style={{
              background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '1px',
              borderRadius: '24px'
            }}></div>
            
            {/* Specular streak */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-24" style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
              filter: 'blur(6px)',
              mixBlendMode: 'screen'
            }}></div>
            
            {/* Fine noise */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='table' tableValues='0 0.03'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)' /></svg>")`,
              backgroundSize: '100px 100px',
              mixBlendMode: 'overlay'
            }}></div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <motion.div
                  layoutId="tool-icon"
                  className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative z-10"
                  style={{ opacity: isExpanding ? 0 : 1 }}
                >
                  {isStreaming ? (
                    <CircleDashed className="h-5 w-5 text-white/90 animate-spin" style={{ opacity: isExpanding ? 0 : 1 }} />
                  ) : (
                    <CurrentToolIcon className="h-5 w-5 text-white/90" style={{ opacity: isExpanding ? 0 : 1 }} />
                  )}
                </motion.div>
              </div>

              <div className="flex-1 min-w-0 relative z-10" style={{ opacity: isExpanding ? 0 : 1 }}>
                <motion.div layoutId="tool-title" className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-white/90 truncate">
                    {getUserFriendlyToolName(toolName)}
                  </h4>
                </motion.div>

                <motion.div layoutId="tool-status" className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isStreaming
                      ? "bg-white/80 animate-pulse"
                      : isSuccess
                        ? "bg-green-400"
                        : "bg-red-400"
                  )} />
                  <span className="text-xs text-white/70 truncate">
                    {isStreaming
                      ? `${agentName || 'Iris'} is working...`
                      : isSuccess
                        ? "Success"
                        : "Failed"
                    }
                  </span>
                </motion.div>
              </div>

              {/* Apple-style notification indicators - only for multiple notification types */}
              {showIndicators && indicatorTotal === 2 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent tool expansion
                    // Toggle between the two notifications (binary switch)
                    const nextIndex = indicatorIndex === 0 ? 1 : 0;
                    onIndicatorClick?.(nextIndex);
                  }}
                  className="flex items-center gap-1.5 mr-3 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors relative z-10"
                  style={{ opacity: isExpanding ? 0 : 1 }}
                >
                  {Array.from({ length: indicatorTotal }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "transition-all duration-300 ease-out rounded-full",
                        index === indicatorIndex
                          ? "w-6 h-2 bg-white/80"
                          : "w-3 h-2 bg-white/40"
                      )}
                    />
                  ))}
                </button>
              )}

              <Button value='ghost' className="bg-transparent hover:bg-transparent flex-shrink-0 relative z-10" style={{ opacity: isExpanding ? 0 : 1 }}>
                <Maximize2 className="h-4 w-4 text-white/70 group-hover:text-white/90 transition-colors" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 