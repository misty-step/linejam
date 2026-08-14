'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { captureError } from '@/lib/error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, {
      boundary: 'app/global-error.tsx',
      ...(error.digest ? { digest: error.digest } : {}),
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[var(--color-background)] px-6 text-center">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-surface)] opacity-60 blur-[100px]" />

          <div className="relative z-10 max-w-xl space-y-6 animate-fade-in-up">
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-wider text-[var(--color-primary)]">
                Global boundary
              </p>
              <h2 className="font-[var(--font-display)] text-3xl leading-tight text-[var(--color-text-primary)] md:text-5xl">
                Application error
              </h2>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] md:text-base">
                Linejam hit an unexpected failure and could not recover
                automatically.
              </p>
            </div>

            <Button
              className="bg-[var(--color-background)]/50 backdrop-blur-sm"
              onClick={reset}
              size="md"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
