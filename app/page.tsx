'use client';

import Link from 'next/link';
import { Button } from '../components/ui/Button';

const EXAMPLE_POEM = [
  { words: 1, text: 'Moonlight' },
  { words: 2, text: 'spills across' },
  { words: 3, text: 'dusty piano keys' },
  { words: 4, text: 'I forgot my sandwich' },
  { words: 5, text: 'refrigerator humming empty promises tonight' },
  { words: 4, text: 'waiting for someone' },
  { words: 3, text: 'who never' },
  { words: 2, text: 'shows up' },
  { words: 1, text: 'anyway' },
];

const STEPS = [
  {
    number: '1',
    title: 'Start a Room',
    description: 'Create a game with a shareable code',
  },
  {
    number: '2',
    title: 'Write Together',
    description: 'Take turns adding one line each',
  },
  {
    number: '3',
    title: 'Reveal & Laugh',
    description: 'See the absurd poems emerge',
  },
];

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

          {/* Divider */}
          <div className="theme-divider" aria-hidden="true" />

          {/* How It Works */}
          <section className="space-y-8">
            <h2 className="text-2xl md:text-3xl font-[var(--font-display)] font-medium text-[var(--color-text-primary)]">
              How It Works
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              {STEPS.map((step) => (
                <div key={step.number} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-[var(--font-display)] font-bold text-[var(--color-primary)]">
                      {step.number}
                    </span>
                    <h3 className="text-lg font-[var(--font-sans)] font-medium text-[var(--color-text-primary)]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)]">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Divider */}
          <div className="theme-divider" aria-hidden="true" />

          {/* The Magic */}
          <section className="space-y-6 max-w-lg">
            <h2 className="text-2xl md:text-3xl font-[var(--font-display)] font-medium text-[var(--color-text-primary)]">
              The Magic
            </h2>
            <p className="text-[var(--color-text-secondary)] font-[var(--font-sans)] leading-relaxed">
              Each player sees only a fragment of what came before. Word counts
              follow a diamond pattern—1, 2, 3, 4, 5, 4, 3, 2, 1—creating poems
              that expand then contract. The result? Collaborative absurdity you
              couldn&apos;t write alone.
            </p>
          </section>

          {/* Divider */}
          <div className="theme-divider" aria-hidden="true" />

          {/* Example Poem */}
          <section className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-[var(--font-display)] font-medium text-[var(--color-text-primary)]">
              What You Get
            </h2>

            <div className="paper rounded-lg p-8 md:p-12 max-w-md mx-auto">
              <div className="space-y-1 text-center">
                {EXAMPLE_POEM.map((line, index) => (
                  <p
                    key={index}
                    className="font-[var(--font-display)] text-[var(--color-text-primary)] leading-relaxed"
                    style={{
                      fontSize: `${1 + line.words * 0.1}rem`,
                    }}
                  >
                    {line.text}
                  </p>
                ))}
              </div>
              <p className="text-center text-sm text-[var(--color-text-muted)] mt-6 font-[var(--font-sans)]">
                A real poem from Linejam
              </p>
            </div>
          </section>

          {/* Final CTA */}
          <section className="pt-8">
            <Link href="/host" className="block max-w-md">
              <Button
                className="w-full h-16 text-xl font-[var(--font-sans)] font-medium"
                size="lg"
              >
                Start Writing
              </Button>
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
