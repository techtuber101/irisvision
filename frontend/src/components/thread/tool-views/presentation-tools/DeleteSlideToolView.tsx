import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Hash,
} from 'lucide-react';
import { ToolViewProps } from '../types';
import { formatTimestamp, extractToolData } from '../utils';
import { LoadingState } from '../shared/LoadingState';

interface DeleteSlideData {
  message: string;
  presentation_name: string;
  deleted_slide: number;
  deleted_title: string;
  remaining_slides: number;
}

export function DeleteSlideToolView({
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  name,
  project,
}: ToolViewProps) {
  const { toolResult } = extractToolData(toolContent);

  let deleteData: DeleteSlideData | null = null;
  let error: string | null = null;

  try {
    if (toolResult && toolResult.toolOutput && toolResult.toolOutput !== 'STREAMING') {
      const output = toolResult.toolOutput;
      if (typeof output === 'string') {
        try {
          deleteData = JSON.parse(output);
        } catch (e) {
          console.error('Failed to parse tool output:', e);
          error = 'Failed to parse delete data';
        }
      } else {
        deleteData = output as unknown as DeleteSlideData;
      }
    }
  } catch (e) {
    console.error('Error parsing delete data:', e);
    error = 'Failed to parse delete data';
  }

  return (
    <Card className="gap-0 flex flex-col h-full overflow-hidden rounded-3xl border border-white/60 bg-white/60 p-0 shadow-[0_25px_45px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/80 dark:shadow-none">
      <CardHeader className="h-14 rounded-t-3xl border-b border-white/40 bg-white/40 p-2 px-4 backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-900/80">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/50 bg-white/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6),0_10px_25px_-15px_rgba(239,68,68,0.6)] backdrop-blur-md dark:border-red-500/30 dark:bg-red-500/20 dark:shadow-none">
              <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                Delete Slide
              </CardTitle>
              {deleteData && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {deleteData.deleted_title}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isStreaming && !error && deleteData && (
              <Badge
                variant="secondary"
                className="border border-emerald-200/70 bg-white/60 text-emerald-600 shadow-[0_8px_20px_-15px_rgba(16,185,129,0.8)] backdrop-blur-md dark:border-emerald-800/60 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Deleted
              </Badge>
            )}
            {!isStreaming && (error || !isSuccess) && (
              <Badge
                variant="secondary"
                className="border border-rose-200/70 bg-white/60 text-rose-600 shadow-[0_8px_20px_-15px_rgba(244,63,94,0.8)] backdrop-blur-md dark:border-rose-800/60 dark:bg-rose-900/40 dark:text-rose-300"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
        {isStreaming ? (
          <LoadingState
            icon={Trash2}
            iconColor="text-red-500 dark:text-red-400"
            bgColor="bg-gradient-to-b from-red-100 to-red-50 shadow-inner dark:from-red-800/40 dark:to-red-900/60 dark:shadow-red-950/20"
            title="Deleting slide"
            filePath="Removing slide file..."
            showProgress={true}
          />
        ) : error || !deleteData ? (
          <div className="flex h-full flex-col items-center justify-center bg-white/35 py-12 px-6 backdrop-blur-xl dark:bg-zinc-950/70">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-rose-200/70 bg-white/60 shadow-[0_20px_35px_-25px_rgba(244,63,94,0.8)] backdrop-blur-lg dark:border-rose-800/60 dark:bg-rose-900/50">
              <AlertTriangle className="h-10 w-10 text-rose-500 dark:text-rose-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-zinc-800 dark:text-zinc-100">
              {error || 'Failed to delete slide'}
            </h3>
            <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
              There was an error deleting the slide. Please try again.
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-white/35 py-12 px-6 backdrop-blur-xl dark:bg-zinc-950/70">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-200/70 bg-white/60 shadow-[0_25px_45px_-30px_rgba(16,185,129,0.8)] backdrop-blur-lg dark:border-emerald-800/60 dark:bg-emerald-900/50">
              <CheckCircle className="h-10 w-10 text-emerald-500 dark:text-emerald-600" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-zinc-800 dark:text-zinc-100">
              Slide deleted successfully
            </h3>
            <p className="mb-6 max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
              {deleteData.message}
            </p>

            <div className="grid w-full max-w-md grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/55 p-4 text-center shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-900/70 dark:shadow-none">
                <div className="mb-2 flex items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Hash className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-200">
                    Deleted Slide
                  </span>
                </div>
                <p className="text-lg font-semibold text-rose-500 dark:text-red-400">
                  #{deleteData.deleted_slide}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/55 p-4 text-center shadow-[0_18px_35px_-25px_rgba(15,23,42,0.45)] backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-900/70 dark:shadow-none">
                <div className="mb-2 flex items-center justify-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <FileText className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-200">
                    Remaining
                  </span>
                </div>
                <p className="text-lg font-semibold text-emerald-500 dark:text-emerald-400">
                  {deleteData.remaining_slides}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <div className="flex h-10 items-center justify-end rounded-b-3xl border-t border-white/40 bg-white/45 px-4 py-2 backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-900/80">
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
          <Clock className="h-3 w-3" />
          <span>
            {formatTimestamp(toolTimestamp)}
          </span>
        </div>
      </div>
    </Card>
  );
}
