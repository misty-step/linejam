'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
  return (
    <section
      aria-label={title}
      data-testid={testId}
      className={cn(
        'lj-game-frame lj-viewport-offset fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-background text-text-primary',
        className
      )}
    >
      <div className="lj-safe-frame mx-auto flex min-h-full w-full max-w-[1920px] flex-col md:[--lj-safe-frame-space:2.5rem] xl:[--lj-safe-frame-space:3.5rem]">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 md:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-[0.32em] text-primary">
              Linejam stage
            </p>
            <h1 className="mt-2 text-3xl font-[var(--font-display)] leading-none md:text-5xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-3xl text-lg text-text-secondary md:text-2xl">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-base font-medium text-text-primary shadow-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 md:h-14 md:px-5"
            aria-label="Exit presentation"
          >
            <X className="h-5 w-5" />
            <span>Exit</span>
          </button>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </section>
  );
}
