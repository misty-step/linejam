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
        'fixed inset-0 z-[70] min-h-screen overflow-y-auto bg-background text-text-primary',
        className
      )}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col p-6 md:p-10 xl:p-14">
        <header className="mb-8 flex items-start justify-between gap-6">
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
            className="inline-flex h-14 shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-5 text-base font-medium text-text-primary shadow-sm transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
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
