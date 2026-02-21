'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { convex } from '../lib/convex';
import { ThemeProvider } from '@/lib/themes';
import { PostHogProvider } from '@/lib/posthog/PostHogProvider';
import { PostHogPageview } from '@/lib/posthog/PostHogPageview';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <PostHogProvider>
        <PostHogPageview />
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ThemeProvider>{children}</ThemeProvider>
        </ConvexProviderWithClerk>
      </PostHogProvider>
    </ClerkProvider>
  );
}
