'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={cn(
          'relative w-full max-w-md',
          'bg-[var(--color-surface)] border border-[var(--color-border)]',
          'rounded-[var(--radius-md)] shadow-lg',
          'p-6 md:p-8',
          'animate-fade-in-up'
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4',
            'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            'transition-colors duration-[var(--duration-fast)]'
          )}
          aria-label="Close help"
        >
          <X className="w-5 h-5" />
        </button>

        <h2
          id="help-title"
          className="text-2xl font-[var(--font-display)] text-[var(--color-text-primary)] mb-6"
        >
          How to Play
        </h2>

        <div className="space-y-6 text-[var(--color-text-secondary)]">
          <section>
            <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
              The Word Pattern
            </h3>
            <p className="text-sm leading-relaxed">
              Each poem has 9 lines. Write exactly the target number of words
              for each round:
            </p>
            <div className="mt-3 py-3 px-4 bg-[var(--color-muted)] rounded-[var(--radius-sm)] font-mono text-sm text-center tracking-wide">
              1 → 2 → 3 → 4 → 5 → 4 → 3 → 2 → 1
            </div>
          </section>

          <section>
            <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
              Blind Collaboration
            </h3>
            <p className="text-sm leading-relaxed">
              You only see the previous line when writing yours. The full poem
              is revealed at the end — expect surprises and absurdist poetry!
            </p>
          </section>

          <section>
            <h3 className="font-medium text-[var(--color-text-primary)] mb-2">
              The Word Counter
            </h3>
            <p className="text-sm leading-relaxed">
              The squares show your word count. When they all{' '}
              <span className="text-[var(--color-primary)] font-medium">
                fill
              </span>
              , you&apos;re ready to seal your line.
            </p>
          </section>
        </div>

        <Button onClick={onClose} variant="secondary" className="w-full mt-8">
          Got it
        </Button>
      </div>
    </div>
  );
}
