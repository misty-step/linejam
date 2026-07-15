'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DEPLOYMENT_STALE_EVENT } from '@/lib/deploymentSkew';

const DEPLOYMENT_CHECK_INTERVAL_MS = 60_000;

type DeploymentSkewObserverProps = {
  deploymentId?: string;
  reload?: () => void;
};

type HealthPayload = {
  deployment?: { id?: unknown };
};

export function DeploymentSkewObserver({
  deploymentId,
  reload = () => window.location.reload(),
}: DeploymentSkewObserverProps) {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    let disposed = false;

    const markStale = () => setIsStale(true);
    const checkDeployment = async () => {
      if (!deploymentId || disposed) return;

      try {
        const response = await fetch('/api/health', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok || disposed) return;

        const payload = (await response.json()) as HealthPayload;
        const serverDeploymentId = payload.deployment?.id;
        if (
          typeof serverDeploymentId === 'string' &&
          serverDeploymentId !== deploymentId
        ) {
          markStale();
        }
      } catch {
        // Connectivity failures have their own recovery surface. A failed
        // version check is not proof that this client is stale.
      }
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkDeployment();
    };

    window.addEventListener(DEPLOYMENT_STALE_EVENT, markStale);
    window.addEventListener('focus', checkDeployment);
    document.addEventListener('visibilitychange', checkWhenVisible);
    const intervalId = window.setInterval(
      checkDeployment,
      DEPLOYMENT_CHECK_INTERVAL_MS
    );
    void checkDeployment();

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener(DEPLOYMENT_STALE_EVENT, markStale);
      window.removeEventListener('focus', checkDeployment);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [deploymentId]);

  if (!isStale) return null;

  return (
    <div
      aria-label="Linejam was updated"
      className="fixed inset-x-3 top-3 z-[120] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-md border border-primary/40 bg-background px-4 py-3 text-left shadow-lg"
      role="status"
    >
      <p className="text-sm leading-snug text-text-primary">
        Linejam was updated. Your draft is safe—reload to rejoin the latest
        room.
      </p>
      <Button onClick={reload} size="sm" type="button">
        Reload Linejam
      </Button>
    </div>
  );
}
