'use client';

import Link from 'next/link';
import { AuthShowcase } from '@/components/auth/AuthShowcase';

/**
 * Auth Layout: Artistic Split Design
 *
 * Desktop (lg+): 50/50 split - auth form left, poem showcase right
 * Phone/tablet: Focused account task, including landscape phones
 *
 * Uses theme tokens throughout for multi-theme support.
 * Works with all 4 themes: kenya, mono, vintage-paper, hyper.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col lg:flex-row">
      {/* Left: Auth Form */}
      <div className="flex-1 flex flex-col justify-start lg:justify-center px-5 py-8 sm:px-6 sm:py-10 md:px-12 lg:px-16 lg:py-12">
        {/* Wordmark / Home Link */}
        <div className="mb-8 md:mb-12">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-2xl md:text-3xl font-[var(--font-display)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors duration-[var(--duration-normal)]"
          >
            Linejam
          </Link>
        </div>

        {/* Auth Content */}
        <div className="w-full max-w-md mx-auto md:mx-0">{children}</div>

        {/* Footer */}
        <div className="mt-8 md:mt-12 text-sm text-[var(--color-text-muted)] font-[var(--font-sans)]">
          <p>
            Write poems together.
            <br />
            One line at a time.
          </p>
        </div>
      </div>

      {/* Right: Poem Showcase */}
      <div className="hidden lg:block flex-1 bg-[var(--color-surface)] border-l border-[var(--color-border)] min-h-0">
        <AuthShowcase />
      </div>
    </div>
  );
}
