'use client';

import Link from 'next/link';
import { Avatar } from '../components/ui/Avatar';

export default function Home() {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-8 sm:px-10 sm:py-14">
      <h1 className="max-w-[12ch] break-words text-[clamp(2.5rem,9vw,4rem)] font-display font-medium leading-[1.08] text-[var(--color-text-primary)]">
        A little room for words.
      </h1>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">
        A poetry game for people who don’t have to be poets.
      </p>
      <p className="mt-3 text-base font-semibold text-[var(--color-text-primary)]">
        Write a line. Pass it on.
      </p>

      <div className="mt-6 flex items-center gap-2" aria-hidden="true">
        <Avatar
          stableId="home-pip"
          displayName="Pip"
          avatarId="pip"
          size="lg"
        />
        <Avatar
          stableId="home-moss"
          displayName="Moss"
          avatarId="moss"
          size="lg"
        />
        <Avatar
          stableId="home-sunny"
          displayName="Sunny"
          avatarId="sunny"
          size="lg"
        />
        <Avatar
          stableId="home-plum"
          displayName="Plum"
          avatarId="plum"
          size="lg"
        />
      </div>

      <nav
        aria-label="Play Linejam"
        className="mt-7 flex max-w-md flex-col gap-3"
      >
        <Link
          href="/host"
          className="lj-button-primary inline-flex min-h-14 items-center justify-center rounded-[var(--radius-lg)] border px-6 py-3 text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
        >
          Start a game
        </Link>
        <Link
          href="/join"
          className="inline-flex min-h-14 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-lg font-bold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
        >
          Join a room
        </Link>
      </nav>
    </section>
  );
}
