'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * How to Play modal explaining the word count pattern and gameplay mechanics.
 */
export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Trap focus and handle Escape
  useEffect(() => {
    if (!isOpen) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;

    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: keep Tab within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="lj-game-frame lj-viewport-offset fixed inset-x-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="flex max-h-full w-full max-w-md min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-2">
          <h2 id="help-title" className="font-sans text-xl font-bold">
            How to play
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Close help"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto p-5">
          <ol className="space-y-4">
            <li>
              <h3 className="mb-1 font-sans text-base">Write a line</h3>
              <p className="text-sm text-text-secondary">
                Use the word count for this round.
              </p>
            </li>
            <li>
              <h3 className="mb-1 font-sans text-base">Pass it on</h3>
              <p className="text-sm text-text-secondary">
                The next writer sees only your line.
              </p>
            </li>
            <li>
              <h3 className="mb-1 font-sans text-base">Read together</h3>
              <p className="text-sm text-text-secondary">
                After nine rounds, each player reads one complete poem aloud.
              </p>
            </li>
          </ol>
          <p
            className="text-center text-sm font-semibold text-primary"
            aria-label="Words per round: 1, 2, 3, 4, 5, 4, 3, 2, 1"
          >
            1 · 2 · 3 · 4 · 5 · 4 · 3 · 2 · 1
          </p>
          <Button onClick={onClose} variant="secondary" className="w-full">
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
