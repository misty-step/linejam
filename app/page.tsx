'use client';

import Link from 'next/link';
import { Button } from '../components/ui/Button';

export default function Home() {
  return (
    <div className="flex flex-col bg-[var(--color-background)] relative">
      <main className="grid grid-cols-12 gap-8 p-6 md:p-12 lg:p-24">
        {/* Left: Title & Actions (8 cols on desktop) */}
        <div className="col-span-12 md:col-span-8 space-y-16">
          {/* Title with Decorative Border */}
          <div className="space-y-3">
            <h1 className="text-7xl md:text-9xl font-[var(--font-display)] font-bold leading-[0.85] text-[var(--color-text-primary)]">
              Linejam
            </h1>
            <div
              className="text-[var(--color-text-muted)] text-sm tracking-[0.2em]"
              aria-hidden="true"
            >
              ═══════════════════
            </div>
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] font-[var(--font-sans)] max-w-md">
            Write poems together.
            <br />
            One line at a time.
            <br />
            Reveal the unexpected.
          </p>

          {/* Action Buttons */}
          <div className="space-y-4 max-w-md">
            <Link href="/host" className="block w-full group">
              <Button
                className="w-full h-16 text-xl font-[var(--font-sans)] font-medium transition-all duration-300 relative overflow-hidden"
                size="lg"
              >
                <span className="absolute inset-0 bg-[var(--color-primary-hover)] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10">Start a Game</span>
              </Button>
            </Link>

            <Link href="/join" className="block w-full group">
              <Button
                variant="secondary"
                className="w-full h-14 text-lg font-[var(--font-sans)] transition-all duration-300 relative overflow-hidden"
                size="lg"
              >
                <span className="absolute inset-0 bg-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10">Join a Room</span>
              </Button>
            </Link>

            {/* Archive Link */}
            <div className="pt-2">
              <Link
                href="/me/poems"
                className="inline-block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors font-[var(--font-sans)]"
              >
                Archive
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Vertical Japanese Label (4 cols on desktop, hidden on mobile) */}
        <div className="hidden md:flex md:col-span-4 justify-end items-center">
          <div
            className="text-sm font-mono tracking-[0.3em] text-[var(--color-text-muted)] opacity-60"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            詩的共同創作
          </div>
        </div>
      </main>
    </div>
  );
}
