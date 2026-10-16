'use client';

import { useEffect, type ReactNode } from 'react';
import posthog from 'posthog-js';
import { trackPageview } from '@/lib/analytics';
import { linejamPostHogConfig } from './config';
import { markPostHogReady, resetPostHogReady } from './posthogReady';

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (
      globalThis.window !== undefined &&
      process.env.NEXT_PUBLIC_POSTHOG_KEY
    ) {
      try {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
          ...linejamPostHogConfig,
          loaded: () => {
            markPostHogReady();
            // Capture initial pageview here since PostHogPageview's effect
            // fires before init() completes (React child effects run first)
            trackPageview();
          },
        });
      } catch {
        // Product behavior never depends on analytics initialization.
        resetPostHogReady();
      }
    }
    return () => {
      resetPostHogReady();
    };
  }, []);

  return children;
}
