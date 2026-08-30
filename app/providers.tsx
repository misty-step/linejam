'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { convex } from '../lib/convex';
import { ColorModeProvider } from '@/lib/colorMode';
import { PostHogProvider } from '@/lib/posthog/PostHogProvider';
import { PostHogPageview } from '@/lib/posthog/PostHogPageview';
import { DeploymentSkewRejectionObserver } from '@/components/DeploymentSkewRejectionObserver';
import { DeploymentSkewObserver } from '@/components/DeploymentSkewObserver';
import {
  linejamClerkAppearance,
  useClerkColorVariables,
} from '@/lib/clerk/appearance';
import type { ReactNode } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';

export function Providers({
  children,
  deploymentId,
}: {
  children: ReactNode;
  deploymentId?: string;
}) {
  const variables = useClerkColorVariables();
  useVisualViewport();

  return (
    <ClerkProvider
      appearance={{ ...linejamClerkAppearance, variables }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <PostHogProvider>
        <PostHogPageview />
        <DeploymentSkewRejectionObserver />
        <DeploymentSkewObserver deploymentId={deploymentId} />
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ColorModeProvider>{children}</ColorModeProvider>
        </ConvexProviderWithClerk>
      </PostHogProvider>
    </ClerkProvider>
  );
}
