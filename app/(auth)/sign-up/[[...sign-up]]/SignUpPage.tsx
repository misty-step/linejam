'use client';

import { SignUp } from '@clerk/nextjs';
import { useAccountState } from '@/lib/account';
import { AccountsUnavailable } from '@/components/AccountsUnavailable';

/**
 * Clerk sign-up surface. Shared fixed-identity colors, fonts, inputs, and
 * buttons come from the provider; this route only hides Clerk's duplicate
 * heading. The catch-all route receives OAuth callbacks.
 *
 * Explicit local mode keeps account controls outside the guest runtime.
 */
export function SignUpPage() {
  const account = useAccountState();
  if (account.kind === 'local') return <AccountsUnavailable />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-sans font-bold text-[var(--color-text-primary)]">
          Create an account
        </h1>
        <p className="text-[var(--color-text-secondary)] font-sans">
          Keep your poems with you on any device.
        </p>
      </div>

      {/* Clerk SignUp Component — shared appearance from ClerkProvider;
          only the redundant Clerk-native header is hidden here since this
          page renders its own above. */}
      <SignUp
        appearance={{
          elements: {
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
          },
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/callback"
      />
    </div>
  );
}
