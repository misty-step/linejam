'use client';

import Link from 'next/link';
import { AuthShowcase } from '@/components/auth/AuthShowcase';

/**
 * Auth Layout: Artistic Split Design
 *
 * Desktop (md+): 50/50 split - auth form left, poem showcase right
 * Mobile: Stacked - poem banner above form
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
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col md:flex-row">
      {/* Left: Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 md:px-12 lg:px-16 order-2 md:order-1">
        {/* Wordmark / Home Link */}
        <div className="mb-12">
          <Link
            href="/"
            className="text-2xl md:text-3xl font-[var(--font-display)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors duration-[var(--duration-normal)]"
          >
            Linejam
          </Link>
        </div>

        {/* Auth Content */}
        <div className="w-full max-w-md mx-auto md:mx-0">{children}</div>

        {/* Footer */}
        <div className="mt-12 text-sm text-[var(--color-text-muted)] font-[var(--font-sans)]">
          <p>
            Write poems together.
            <br />
            One line at a time.
          </p>
        </div>
      </div>

      {/* Right: Poem Showcase */}
      <div className="flex-1 bg-[var(--color-surface)] border-l-0 md:border-l border-[var(--color-border)] order-1 md:order-2 min-h-[200px] md:min-h-0">
        <AuthShowcase />
      </div>
    </div>
  );
}
