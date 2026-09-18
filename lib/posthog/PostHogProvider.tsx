'use client';

import { useEffect, type ReactNode } from 'react';
import { useAccountState } from '@/lib/account';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { markPostHogReady, resetPostHogReady } from './posthogReady';

export function PostHogProvider({ children }: { children: ReactNode }) {
  const account = useAccountState();
  const enabled = account.kind === 'clerk';
  const user = account.kind === 'clerk' ? account.user : null;
  const isLoaded = account.kind === 'clerk' && account.isLoaded;
  const userId = user?.id;
  const isSignedIn = !!user;

  useEffect(() => {
    if (
      enabled &&
      globalThis.window !== undefined &&
      process.env.NEXT_PUBLIC_POSTHOG_KEY
    ) {
      try {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
          ui_host: 'https://us.posthog.com',
          person_profiles: 'identified_only',
          capture_pageview: false,
          respect_dnt: true,
          session_recording: {
            maskAllInputs: true,
            maskTextSelector: '[data-sensitive]',
          },
          loaded: (ph) => {
            markPostHogReady();
            if (process.env.NODE_ENV === 'development') {
              ph.debug();
            }
            // Capture initial pageview here since PostHogPageview's effect
            // fires before init() completes (React child effects run first)
            if (globalThis.window !== undefined) {
              ph.capture('$pageview', { $current_url: window.location.href });
            }
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('PostHog init failed', error);
        }
      }
    }
    return () => {
      resetPostHogReady();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !process.env.NEXT_PUBLIC_POSTHOG_KEY || !isLoaded) return;

    try {
      if (isSignedIn && userId) {
        posthog.identify(userId, {
          created_at: user?.createdAt?.toISOString(),
        });
      } else if (!isSignedIn) {
        posthog.reset();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('PostHog identity sync failed', error);
      }
    }
  }, [enabled, isSignedIn, isLoaded, userId, user]);

  if (!enabled) return children;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
