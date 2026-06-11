import Link from 'next/link';
import { fetchQuery } from 'convex/nextjs';
import { notFound } from 'next/navigation';
import { api } from '../../../convex/_generated/api';
export { generateMetadata } from './metadata';

export default async function RecapPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const recap = await fetchQuery(api.poems.getPublicSessionRecap, {
    roomCode: code,
  }).catch(() => null);

  if (!recap) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12 md:px-12 lg:px-24">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="space-y-6 border-b border-border pb-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-muted">
            <span>Room {recap.roomCode}</span>
            <span aria-hidden="true">/</span>
            <span>Cycle {recap.cycle}</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-[var(--font-display)] leading-none md:text-7xl">
              Session recap
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-text-secondary">
              {recap.poemCount} poems by {recap.playerCount} poets, gathered
              into one replayable Linejam session.
            </p>
          </div>
        </header>

        <section className="grid gap-8">
          {recap.poems.map((poem) => (
            <article
              key={poem._id}
              className="border border-border bg-surface p-6 shadow-sm md:p-8"
            >
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4 text-xs font-mono uppercase tracking-widest text-text-muted">
                <span>
                  Poem {(poem.indexInRoom + 1).toString().padStart(2, '0')}
                </span>
                <span>
                  Started by {poem.starterName} / read by {poem.readerName}
                </span>
              </div>

              <div className="space-y-5">
                {poem.lines.map((line, index) => (
                  <p
                    key={`${poem._id}-${index}`}
                    className="font-[var(--font-display)] text-xl leading-relaxed md:text-2xl"
                  >
                    {line.text}
                  </p>
                ))}
              </div>

              <div className="mt-6 border-t border-border-subtle pt-4 text-sm text-text-muted">
                By {poem.poetCount} poet{poem.poetCount === 1 ? '' : 's'}
              </div>
            </article>
          ))}
        </section>

        <footer className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
          <Link
            href={`/join?code=${recap.roomCode}`}
            className="inline-flex h-14 items-center justify-center rounded-md border border-primary bg-primary px-8 text-lg font-medium text-text-inverse hover:bg-primary-hover"
          >
            Join this room
          </Link>
          <Link
            href="/"
            className="inline-flex h-14 items-center justify-center rounded-md border border-border bg-surface px-8 text-lg font-medium text-text-primary hover:shadow-md"
          >
            Start a new room
          </Link>
        </footer>
      </div>
    </main>
  );
}
