'use client';

import { Button } from '../../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card';

export default function TestErrorPage() {
  const triggerError = () => {
    throw new Error('Test Sentry capture - this error is intentional');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sentry Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Click the button below to trigger a test error. Check your Sentry
            dashboard to verify the error was captured.
          </p>
          <Button onClick={triggerError} className="w-full">
            Trigger Test Error
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
