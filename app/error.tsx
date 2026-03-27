'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { boundary: 'app/error.tsx' });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-3xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The current round hit an unexpected error. Reload this screen and try
        again.
      </p>
      <button
        className="rounded-full border border-current px-5 py-2 text-sm font-medium"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
