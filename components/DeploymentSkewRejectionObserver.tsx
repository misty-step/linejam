'use client';

import { useEffect } from 'react';
import {
  isUnrecognizedServerActionError,
  notifyDeploymentStale,
} from '@/lib/deploymentSkew';

export function DeploymentSkewRejectionObserver() {
  useEffect(() => {
    // Sentry's SDK owns global error capture. This listener exists only for
    // the product-specific rolling-deployment recovery signal.
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isUnrecognizedServerActionError(event.reason)) return;

      event.preventDefault();
      notifyDeploymentStale();
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
