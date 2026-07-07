'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

/**
 * Sign-In Page
 *
 * Uses Clerk's prebuilt SignIn component. Shared theming (colors, fonts,
 * inputs, buttons — all CSS-variable driven, so every lib/themes preset
 * works automatically) lives once on <ClerkProvider appearance> in
 * app/providers.tsx; this page only overrides what's page-specific (hiding
 * Clerk's own header since we render our own above it).
 * The [[...sign-in]] catch-all route handles OAuth callbacks.
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
