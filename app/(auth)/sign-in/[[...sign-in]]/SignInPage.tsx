'use client';

import { SignIn } from '@clerk/nextjs';
import { useAccountState } from '@/lib/account';
import { AccountsUnavailable } from '@/components/AccountsUnavailable';

/**
 * Clerk sign-in surface. Shared fixed-identity colors, fonts, inputs, and
 * buttons come from the provider; this route only hides Clerk's duplicate
 * heading. The catch-all route receives OAuth callbacks.
 *
 * Explicit local mode keeps account controls outside the guest runtime.
 */
export function SignInPage() {
  const account = useAccountState();
  if (account.kind === 'local') return <AccountsUnavailable />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-sans font-bold text-[var(--color-text-primary)]">
          Welcome back
        </h1>
        <p className="text-[var(--color-text-secondary)] font-sans">
          Sign in to see your saved poems.
        </p>
      </div>

      {/* Clerk SignIn Component — shared appearance from ClerkProvider;
          only the redundant Clerk-native header is hidden here since this
          page renders its own above. */}
      <SignIn
        appearance={{
          elements: {
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/callback"
      />
    </div>
  );
}
