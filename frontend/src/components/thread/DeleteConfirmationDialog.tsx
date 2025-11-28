'use client';

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  threadName: string;
  isDeleting: boolean;
}

/**
 * Confirmation dialog for deleting a conversation
 */
export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  threadName,
  isDeleting,
}: DeleteConfirmationDialogProps) {
  // Reset pointer events when dialog opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.pointerEvents = 'auto';
    }
  }, [isOpen]);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="border border-white/10 dark:border-white/10 bg-[rgba(10,14,22,0.55)] dark:bg-[rgba(10,14,22,0.55)] backdrop-blur-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] light:border-gray-200 light:bg-white light:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1)] overflow-hidden p-0">
        <div className="relative p-6 light:bg-gradient-to-br light:from-white light:via-white light:to-gray-50/50">
          {/* Dark mode gradient rim */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl dark:opacity-100 opacity-0"
            style={{
              background: 'linear-gradient(180deg, rgba(173,216,255,0.18), rgba(255,255,255,0.04) 30%, rgba(150,160,255,0.14) 85%, rgba(255,255,255,0.06))',
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor' as any,
              maskComposite: 'exclude',
              padding: 1,
              borderRadius: 16,
            }}
          />
          
          {/* Dark mode specular streak */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-16 dark:opacity-100 opacity-0"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)',
              filter: 'blur(4px)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Fine noise - dark mode only */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.015] dark:opacity-[0.015] light:opacity-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          <AlertDialogHeader className="relative z-10">
            <AlertDialogTitle>Delete conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the conversation{' '}
              <span className="font-semibold">"{threadName}"</span>?
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="relative z-10">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
