'use client';

import Link from 'next/link';
import { Button } from '../components/ui/Button';

export default function Home() {
  return (
    <div className="flex flex-col bg-[var(--color-background)] relative">
      <main className="max-w-4xl mx-auto p-6 md:p-12 lg:p-24">
        <div className="space-y-16">
          {/* Title */}
          <h1 className="text-7xl md:text-9xl font-[var(--font-display)] font-bold leading-[0.85] text-[var(--color-text-primary)]">
            Linejam
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl leading-relaxed text-[var(--color-text-primary)] font-[var(--font-sans)] max-w-md">
            Write poems together.
            <br />
            One line at a time.
          </p>

          {/* Action Buttons */}
          <div className="space-y-4 max-w-md">
            <Link href="/host" className="block w-full">
              <Button
                className="w-full h-16 text-xl font-[var(--font-sans)] font-medium"
                size="lg"
              >
                Start a Game
              </Button>
            </Link>

            <Link href="/join" className="block w-full">
              <Button
                variant="secondary"
                className="w-full h-14 text-lg font-[var(--font-sans)]"
                size="lg"
              >
                Join a Room
              </Button>
            </Link>

            {/* Archive Link */}
            <div className="pt-2">
              <Link
                href="/me/poems"
                className="inline-block text-sm text-[var(--color-text-secondary)] hover:underline transition-colors font-[var(--font-sans)]"
              >
                Archive
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
