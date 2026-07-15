'use client';

import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

/**
 * Sign-Up Page
 *
 * Uses Clerk's prebuilt SignUp component. Shared theming (colors, fonts,
 * inputs, buttons — all CSS-variable driven, so every lib/themes preset
 * works automatically) lives once on <ClerkProvider appearance> in
 * app/providers.tsx; this page only overrides what's page-specific (hiding
 * Clerk's own header since we render our own above it).
 * The [[...sign-up]] catch-all route handles OAuth callbacks.
 *
 * When Clerk is not configured (no CLERK_SECRET_KEY), shows a message
 * that authentication is unavailable and guests can play without an account.
 */

// Check if Clerk is configured (publishable key available on client)
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function SignUpPage() {
  // Show fallback when Clerk is not configured
  if (!isClerkConfigured) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-[var(--font-display)] text-[var(--color-text-primary)]">
            Authentication unavailable
          </h1>
          <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
            Sign-up is not available in this environment.
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
          Join the jam
        </h1>
        <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
          Create an account to save your poems and track your creations
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
