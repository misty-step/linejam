'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

/**
 * Sign-In Page
 *
 * Uses Clerk's prebuilt SignIn component with custom theming.
 * The [[...sign-in]] catch-all route handles OAuth callbacks.
 *
 * Theme-aware: Clerk appearance uses CSS variables for multi-theme support.
 *
 * When Clerk is not configured (no CLERK_SECRET_KEY), shows a message
 * that authentication is unavailable and guests can play without an account.
 */

// Check if Clerk is configured (publishable key available on client)
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function SignInPage() {
  // Show fallback when Clerk is not configured
  if (!isClerkConfigured) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-[var(--font-display)] text-[var(--color-text-primary)]">
            Authentication unavailable
          </h1>
          <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
            Sign-in is not available in this environment.
          </p>
        </div>
        <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
          <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)] text-sm">
            You can still play as a guest! Your poems will be saved locally.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-[var(--color-primary)] text-[var(--color-text-inverse)] rounded-[var(--radius-md)] font-[var(--font-sans)] font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Play as guest
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-[var(--font-display)] text-[var(--color-text-primary)]">
          Welcome back
        </h1>
        <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
          Sign in to continue your creative journey
        </p>
      </div>

      {/* Clerk SignIn Component */}
      <SignIn
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
            // Identity preview (after first step)
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
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/callback"
      />

      {/* Footer Link */}
      <div className="pt-4 border-t border-[var(--color-border-subtle)]">
        <p className="text-sm text-[var(--color-text-muted)] font-[var(--font-sans)]">
          Don&apos;t have an account?{' '}
          <Link
            href="/sign-up"
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
