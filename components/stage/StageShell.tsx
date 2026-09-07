'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Brand } from '@/components/Brand';

interface StageShellProps {
  children: ReactNode;
  onExit: () => void;
  testId: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export function StageShell({
  children,
  onExit,
  testId,
  title,
  subtitle,
  className,
}: StageShellProps) {
  const stageRef = useRef<HTMLElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    exitRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  return (
    <section
      ref={stageRef}
      role="dialog"
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onExit();
          return;
        }
        if (event.key !== 'Tab' || !stageRef.current) return;
        const focusable = stageRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      aria-label={title}
      data-testid={testId}
      className={cn(
        'lj-game-frame lj-viewport-offset fixed inset-0 z-[70] flex flex-col overflow-hidden bg-background text-text-primary',
        className
      )}
    >
      <div className="lj-safe-frame mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col md:[--lj-safe-frame-space:2rem] xl:[--lj-safe-frame-space:3rem]">
        <header className="mb-5 grid max-h-[40%] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 overflow-y-auto border-b border-border pb-4 md:gap-6">
          <div className="min-w-0">
            <Brand className="mb-3 text-xl md:text-2xl" />
            <h1 className="break-words text-xl font-bold leading-tight md:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-3xl break-words text-base text-text-secondary md:text-xl">
                {subtitle}
              </p>
            )}
          </div>
          <button
            ref={exitRef}
            type="button"
            onClick={onExit}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-base font-semibold text-text-primary transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
            aria-label="Exit presentation"
          >
            <X className="h-[20px] w-[20px] shrink-0" aria-hidden="true" />
            <span>Exit</span>
          </button>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {children}
        </div>
      </div>
    </section>
  );
}
