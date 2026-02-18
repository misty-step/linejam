'use client';

import { Alert } from './ui/Alert';
import { Button } from './ui/Button';

type Props = {
  message: string;
  onRetry: () => void;
  title?: string;
  retryLabel?: string;
};

export function AuthErrorState({
  message,
  onRetry,
  title = 'Connection error',
  retryLabel = 'Try again',
}: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] gap-4 p-6">
      {title ? (
        <span className="text-[var(--color-text-primary)] text-xl">
          {title}
        </span>
      ) : null}
      <Alert variant="error" className="max-w-xl w-full">
        {message}
      </Alert>
      <Button onClick={onRetry} className="w-full max-w-xl">
        {retryLabel}
      </Button>
    </div>
  );
}
