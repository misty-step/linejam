'use client';

import { ClerkProvider, useAuth, useUser } from '@clerk/nextjs';
import { ConvexProvider, useConvexAuth } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import {
  AccountContext,
  type AccountState,
  type ClerkAccountState,
} from '@/lib/account';
import { UserProvider } from '@/lib/auth';
import { convex } from '@/lib/convex';
import {
  linejamClerkAppearance,
  useClerkColorVariables,
} from '@/lib/clerk/appearance';
import { ColorModeProvider } from '@/lib/colorMode';
import { PostHogProvider } from '@/lib/posthog/PostHogProvider';
import { PostHogPageview } from '@/lib/posthog/PostHogPageview';
import { DeploymentSkewRejectionObserver } from '@/components/DeploymentSkewRejectionObserver';
import { DeploymentSkewObserver } from '@/components/DeploymentSkewObserver';
import { useMemo, type ReactNode } from 'react';
import { useVisualViewport } from '@/hooks/useVisualViewport';

const localAccountState: AccountState = { kind: 'local' };

export function Providers({
  children,
  deploymentId,
  localMode,
}: {
  children: ReactNode;
  deploymentId?: string;
  localMode: boolean;
}) {
  useVisualViewport();

  return (
    <AccountProvider localMode={localMode}>
      <UserProvider>
        <PostHogProvider>
          <PostHogPageview />
          <DeploymentSkewRejectionObserver />
          <DeploymentSkewObserver deploymentId={deploymentId} />
          <ColorModeProvider>{children}</ColorModeProvider>
        </PostHogProvider>
      </UserProvider>
    </AccountProvider>
  );
}
function ClerkAccountBridge({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const account = useMemo<ClerkAccountState>(
    () => ({
      kind: 'clerk',
      user: user ?? null,
      isLoaded,
      convex: { isLoading, isAuthenticated },
    }),
    [user, isLoaded, isLoading, isAuthenticated]
  );
  return (
    <AccountContext.Provider value={account}>
      {children}
    </AccountContext.Provider>
  );
}

function ConnectedAccountProvider({ children }: { children: ReactNode }) {
  const variables = useClerkColorVariables();
  return (
    <ClerkProvider
      appearance={{ ...linejamClerkAppearance, variables }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ClerkAccountBridge>{children}</ClerkAccountBridge>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function AccountProvider({
  children,
  localMode,
}: {
  children: ReactNode;
  localMode: boolean;
}) {
  if (!localMode)
    return <ConnectedAccountProvider>{children}</ConnectedAccountProvider>;
  return (
    <ConvexProvider client={convex}>
      <AccountContext.Provider value={localAccountState}>
        {children}
      </AccountContext.Provider>
    </ConvexProvider>
  );
}
