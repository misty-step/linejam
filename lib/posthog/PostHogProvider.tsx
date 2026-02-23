'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

export function PostHogProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
        ui_host: 'https://us.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        respect_dnt: true,
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: '*',
        },
        loaded: (ph) => {
          if (process.env.NODE_ENV === 'development') {
            ph.debug();
          }
          // Capture initial pageview here since PostHogPageview's effect
          // fires before init() completes (React child effects run first)
          if (typeof window !== 'undefined') {
            ph.capture('$pageview', { $current_url: window.location.href });
          }
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || !isLoaded) return;

    if (isSignedIn && userId) {
      posthog.identify(userId, {
        created_at: user?.createdAt?.toISOString(),
      });
    } else if (!isSignedIn) {
      posthog.reset();
    }
  }, [isSignedIn, isLoaded, userId, user]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
