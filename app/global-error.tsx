'use client';

import { useEffect } from 'react';
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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="text-3xl font-semibold">Application error</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Linejam hit an unexpected failure and could not recover
            automatically.
          </p>
          <button
            className="rounded-full border border-current px-5 py-2 text-sm font-medium"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
