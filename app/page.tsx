'use client';

import Link from 'next/link';
import { Button } from '../components/ui/Button';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] relative overflow-hidden">
      {/* Decorative Grid Line */}
      <div className="absolute top-0 left-6 w-px h-full bg-[var(--color-border-subtle)] hidden md:block" />
      <div className="absolute top-0 right-6 w-px h-full bg-[var(--color-border-subtle)] hidden md:block" />

      <main className="flex-1 flex flex-col md:flex-row relative z-10">
        {/* Left Panel: Brand & Manifesto */}
        <div className="flex-1 p-8 md:p-12 lg:p-20 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[var(--color-border)]">
          <div className="space-y-8">
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-[var(--font-display)] tracking-tighter leading-[0.8]">
              Line
              <br />
              jam
            </h1>
            <div className="max-w-md space-y-6">
              <p className="text-xl md:text-2xl font-[var(--font-display)] italic leading-relaxed text-[var(--color-text-secondary)]">
                &ldquo;Poetry is the spontaneous overflow of powerful feelings:
                it takes its origin from emotion recollected in
                tranquility.&rdquo;
              </p>
              <div className="h-px w-12 bg-[var(--color-primary)]" />
              <p className="text-base md:text-lg text-[var(--color-text-primary)]">
                A digital parlor game for friends. <br />
                Write together. Reveal the unexpected.
              </p>
            </div>
          </div>

          <div className="hidden md:block pt-12">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
              Est. 2025 — v1.0
            </span>
          </div>
        </div>

        {/* Right Panel: Actions */}
        <div className="flex-1 p-8 md:p-12 lg:p-20 flex flex-col justify-center bg-[var(--color-surface)]/50">
          <div className="max-w-sm mx-auto w-full space-y-8">
            <div className="space-y-4">
              <Link href="/host" className="block w-full group">
                <Button
                  className="w-full h-16 text-xl justify-between group-hover:-translate-y-1 transition-transform"
                  size="lg"
                >
                  <span>Host a Game</span>
                  <span className="opacity-50 group-hover:opacity-100">→</span>
                </Button>
              </Link>

              <Link href="/join" className="block w-full group">
                <Button
                  variant="secondary"
                  className="w-full h-16 text-xl justify-between group-hover:-translate-y-1 transition-transform"
                  size="lg"
                >
                  <span>Join Room</span>
                  <span className="opacity-50 group-hover:opacity-100">→</span>
                </Button>
              </Link>
            </div>

            <div className="pt-8 border-t border-[var(--color-border-subtle)]">
              <Link
                href="/me/poems"
                className="inline-flex items-center space-x-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors font-mono text-sm uppercase tracking-wide"
              >
                <span>Archive</span>
                <span>↗</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
