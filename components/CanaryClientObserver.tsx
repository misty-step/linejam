'use client';

import { useEffect } from 'react';
import { captureCanaryException } from '@/lib/canary';
import {
  isUnrecognizedServerActionError,
  notifyDeploymentStale,
} from '@/lib/deploymentSkew';

function captureBrowserFailure(error: unknown, source: string) {
  void captureCanaryException(error, {
    source,
    path: window.location.pathname,
  });
}

export function CanaryClientObserver() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      captureBrowserFailure(
        event.error ?? new Error(event.message || 'Unhandled browser error'),
        'window.error'
      );
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isUnrecognizedServerActionError(event.reason)) {
        event.preventDefault();
        notifyDeploymentStale();
        return;
      }

      captureBrowserFailure(
        event.reason ?? new Error('Unhandled promise rejection'),
        'window.unhandledrejection'
      );
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
