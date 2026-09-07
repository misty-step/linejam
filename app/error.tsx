'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { captureError } from '@/lib/error';
import { Brand } from '@/components/Brand';

export default function Error({
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
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--color-background)] px-5 py-12">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8">
        <Brand />
        <div className="space-y-3">
          <h1 className="font-sans font-bold text-3xl leading-tight text-[var(--color-text-primary)]">
            Something went wrong
          </h1>
          <p className="leading-relaxed text-[var(--color-text-secondary)]">
            This screen could not load. Try again to pick up where you left off.
          </p>
        </div>
        <Button onClick={reset} type="button" className="self-start">
          Try again
        </Button>
      </div>
    </div>
  );
}
