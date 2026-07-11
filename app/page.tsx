'use client';

import Link from 'next/link';
import { Button } from '../components/ui/Button';

export default function Home() {
  const renderActions = () => (
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
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)] relative">
      <main className="max-w-4xl mx-auto p-6 pb-32 md:p-12 lg:p-24">
        <div className="space-y-8 md:space-y-16">
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
          <p className="max-w-md text-base md:text-lg leading-relaxed text-[var(--color-text-secondary)]">
            Pass the phone around a room-code game, then read the surprise poems
            aloud.
          </p>

          {/* Action Buttons - inline on tablet/desktop */}
          <div className="hidden md:block">{renderActions()}</div>
        </div>
      </main>

      {/* Thumb-zone action bar on phones */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-6 bg-background/95 backdrop-blur-md border-t-2 border-primary/20 shadow-[var(--shadow-lg)]">
        {renderActions()}
      </div>
    </div>
  );
}
