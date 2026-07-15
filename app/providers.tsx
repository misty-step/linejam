'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { convex } from '../lib/convex';
import { ThemeProvider } from '@/lib/themes';
import { PostHogProvider } from '@/lib/posthog/PostHogProvider';
import { PostHogPageview } from '@/lib/posthog/PostHogPageview';
import { CanaryClientObserver } from '@/components/CanaryClientObserver';
import { DeploymentSkewObserver } from '@/components/DeploymentSkewObserver';
import {
  linejamClerkAppearance,
  useClerkThemeVariables,
} from '@/lib/clerk/appearance';
import { ReactNode } from 'react';

export function Providers({
  children,
  deploymentId,
}: {
  children: ReactNode;
  deploymentId?: string;
}) {
  const variables = useClerkThemeVariables();

  return (
    <ClerkProvider
      appearance={{ ...linejamClerkAppearance, variables }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <PostHogProvider>
        <PostHogPageview />
        <CanaryClientObserver />
        <DeploymentSkewObserver deploymentId={deploymentId} />
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ThemeProvider>{children}</ThemeProvider>
        </ConvexProviderWithClerk>
      </PostHogProvider>
    </ClerkProvider>
  );
}
