'use client';

import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

/**
 * Sign-Up Page
 *
 * Uses Clerk's prebuilt SignUp component with custom theming.
 * The [[...sign-up]] catch-all route handles OAuth callbacks.
 *
 * Theme-aware: Clerk appearance uses CSS variables for multi-theme support.
 */
export default function SignUpPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-[var(--font-display)] text-[var(--color-text-primary)]">
          Join the jam
        </h1>
        <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
          Create an account to save your poems and track your creations
        </p>
      </div>

      {/* Clerk SignUp Component */}
      <SignUp
        appearance={{
          elements: {
            // Root container
            rootBox: 'w-full',
            card: 'shadow-none border-0 p-0 bg-transparent',
            // Header (hide default, we use custom)
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            // Form
            formButtonPrimary:
              'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-text-inverse)] font-[var(--font-sans)] font-medium h-12 rounded-[var(--radius-md)] transition-all duration-[var(--duration-normal)]',
            formFieldInput:
              'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-[var(--font-sans)] h-12 rounded-[var(--radius-md)] focus:border-[var(--color-primary)] focus:ring-[var(--color-focus-ring)] focus:ring-2 focus:ring-offset-2',
            formFieldLabel:
              'text-[var(--color-text-secondary)] font-[var(--font-sans)] text-sm',
            formFieldInputShowPasswordButton:
              'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            // Social buttons
            socialButtonsBlockButton:
              'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-[var(--font-sans)] h-12 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] transition-all duration-[var(--duration-normal)]',
            socialButtonsBlockButtonText: 'font-medium',
            // Divider
            dividerLine: 'bg-[var(--color-border)]',
            dividerText:
              'text-[var(--color-text-muted)] font-[var(--font-sans)] text-sm',
            // Footer
            footerActionText:
              'text-[var(--color-text-secondary)] font-[var(--font-sans)]',
            footerActionLink:
              'text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium',
            // Identity preview
            identityPreviewText:
              'text-[var(--color-text-primary)] font-[var(--font-sans)]',
            identityPreviewEditButton:
              'text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]',
            // Alert/Error states
            alert:
              'bg-[var(--color-error)]/10 border-[var(--color-error)] text-[var(--color-error)]',
            // OTP input
            otpCodeFieldInput:
              'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] font-[var(--font-mono)] text-xl rounded-[var(--radius-md)]',
          },
          layout: {
            socialButtonsPlacement: 'top',
            socialButtonsVariant: 'blockButton',
          },
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />

      {/* Footer Link */}
      <div className="pt-4 border-t border-[var(--color-border-subtle)]">
        <p className="text-sm text-[var(--color-text-muted)] font-[var(--font-sans)]">
          Already have an account?{' '}
          <Link
            href="/sign-in"
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
