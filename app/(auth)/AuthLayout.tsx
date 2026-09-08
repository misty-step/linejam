'use client';

import Link from 'next/link';
import { AuthShowcase } from '@/components/auth/AuthShowcase';
import { Brand } from '@/components/Brand';
import type { ComponentType, ReactNode } from 'react';

/**
 * Split auth layout: form first on phones and a 50/50 form/showcase composition
 * on large screens. All surfaces consume the fixed identity's mode tokens.
 */
export interface AuthLayoutDependencies {
  ShowcaseComponent: ComponentType;
}

const defaultAuthLayoutDependencies: AuthLayoutDependencies = {
  ShowcaseComponent: AuthShowcase,
};

interface AuthLayoutProps {
  children: ReactNode;
  dependencies?: AuthLayoutDependencies;
}

export function AuthLayout({
  children,
  dependencies = defaultAuthLayoutDependencies,
}: AuthLayoutProps) {
  const ShowcaseComponent = dependencies.ShowcaseComponent;
  return (
    <div className="min-h-dvh bg-[var(--color-background)] flex flex-col lg:flex-row">
      {/* Left: Auth Form */}
      <div className="flex-1 flex flex-col justify-start lg:justify-center px-5 py-8 sm:px-6 sm:py-10 md:px-12 lg:px-16 lg:py-12">
        {/* Wordmark / Home Link */}
        <div className="mb-8 md:mb-12">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <Brand />
          </Link>
        </div>

        {/* Auth Content */}
        <div className="w-full max-w-md mx-auto md:mx-0 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 sm:p-8">
          {children}
        </div>

        {/* Footer */}
        <div className="mt-8 md:mt-12 text-sm text-[var(--color-text-muted)] font-sans">
          <p>No account needed to play.</p>
        </div>
      </div>

      {/* Right: Poem Showcase */}
      <div className="hidden lg:block flex-1 min-h-0">
        <ShowcaseComponent />
      </div>
    </div>
  );
}
