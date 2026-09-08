'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { captureError } from '@/lib/error';
import { Brand } from '@/components/Brand';
import { renderDesignTokensCss } from '@/lib/design/css';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A digest marks a server-render failure already owned by onRequestError.
    if (!error.digest) captureError(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <style>{renderDesignTokensCss()}</style>
      </head>
      <body>
        <main className="min-h-dvh bg-[var(--color-background)] px-5 py-12">
          <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-md flex-col justify-center gap-8">
            <Brand />
            <div className="space-y-3">
              <h1 className="font-sans font-bold text-3xl leading-tight text-[var(--color-text-primary)]">
                Linejam could not load
              </h1>
              <p className="leading-relaxed text-[var(--color-text-secondary)]">
                Try again to reopen the game.
              </p>
            </div>
            <Button onClick={reset} type="button" className="self-start">
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
