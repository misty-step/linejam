import type { ReactElement } from 'react';
import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { notFound } from 'next/navigation';
import { api } from '../../../convex/_generated/api';
import { RecapExportButton } from '../../../components/RecapExportButton';
import { formatAttribution } from '../../../lib/poemCard/PoemCard';
import { getConvexServerUrl } from '@/lib/localMode';
import { Brand } from '@/components/Brand';

export type SessionRecap = {
  roomCode: string;
  cycle: number;
  poemCount: number;
  playerCount: number;
  roomIdHash: string;
  poems: Array<{
    _id: string;
    indexInRoom: number;
    starterName: string;
    readerName: string;
    lines: Array<{ text: string; authorName: string }>;
  }>;
};

export interface RecapPageDependencies {
  fetchSessionRecap(roomCode: string): Promise<SessionRecap | null>;
}

export interface RecapPageProps {
  params: Promise<{ code: string }>;
}

export type RecapPageHandler = (props: RecapPageProps) => Promise<ReactElement>;

export const defaultRecapPageDependencies: RecapPageDependencies = {
  fetchSessionRecap: (roomCode) =>
    fetchQuery(
      api.poems.getPublicSessionRecap,
      { roomCode },
      { url: getConvexServerUrl() }
    ),
};

export function createRecapPage(
  dependencies: RecapPageDependencies = defaultRecapPageDependencies
): RecapPageHandler {
  return async function RecapPage({ params }: RecapPageProps) {
    const { code } = await params;
    const recap = await dependencies.fetchSessionRecap(code).catch(() => null);

    if (!recap) {
      notFound();
    }

    return (
      <main className="min-h-screen bg-background font-sans text-text-primary">
        <div className="lj-safe-inline mx-auto max-w-3xl space-y-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-10">
          <Link
            href="/"
            aria-label="Linejam home"
            className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring print:hidden"
          >
            <Brand />
          </Link>
          <header className="space-y-2">
            <h1 className="text-2xl font-bold leading-snug sm:text-3xl">
              Session recap
            </h1>
            <p className="text-text-secondary">
              {recap.poemCount} poem{recap.poemCount === 1 ? '' : 's'} by{' '}
              {recap.playerCount} poet{recap.playerCount === 1 ? '' : 's'}
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
              <span>Room {recap.roomCode}</span>
              <span>Session {recap.cycle}</span>
            </p>
          </header>

          <RecapExportButton
            poemCount={recap.poemCount}
            roomIdHash={recap.roomIdHash}
            cycle={recap.cycle}
          />

          <section aria-label="Session poems" className="space-y-5">
            {recap.poems.map((poem) => {
              const attribution = formatAttribution(poem.lines);

              return (
                <article
                  key={poem._id}
                  aria-labelledby={`recap-poem-${poem._id}`}
                  className="poem-print-surface rounded-3xl bg-surface p-5 sm:p-8"
                >
                  <header className="mb-5 space-y-1">
                    <h2
                      id={`recap-poem-${poem._id}`}
                      className="text-lg font-bold"
                    >
                      Poem {poem.indexInRoom + 1}
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary [overflow-wrap:anywhere]">
                      <span>Started by {poem.starterName}</span>
                      <span>Read by {poem.readerName}</span>
                    </div>
                  </header>

                  <div className="space-y-2">
                    {poem.lines.map((line, index) => (
                      <p
                        key={`${poem._id}-${index}`}
                        className="whitespace-pre-wrap text-xl not-italic leading-relaxed [overflow-wrap:anywhere] sm:text-2xl"
                      >
                        {line.text}
                      </p>
                    ))}
                  </div>

                  <p className="mt-5 border-t border-border-subtle pt-4 text-sm leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
                    <span className="sr-only">Written by </span>
                    {attribution}
                  </p>
                </article>
              );
            })}
          </section>

          <footer className="flex flex-col gap-3 pt-2 print:hidden sm:flex-row">
            <Link
              href={`/join?code=${recap.roomCode}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 py-3 text-base font-bold text-text-inverse hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
            >
              Join this room
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border bg-surface px-6 py-3 text-base font-bold hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
            >
              Start a new room
            </Link>
          </footer>
        </div>
      </main>
    );
  };
}

export default createRecapPage();
