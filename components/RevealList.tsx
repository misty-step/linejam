import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@/lib/auth';
import { Label } from '@/components/ui/Label';
import Link from 'next/link';

interface RevealListProps {
  roomCode: string;
}

export default function RevealList({ roomCode }: RevealListProps) {
  const { guestToken } = useUser();
  const poems = useQuery(api.poems.getPoemsForRoom, {
    roomCode,
    guestToken: guestToken || undefined,
  });

  if (!poems) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-24">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-6 border-b border-[var(--color-border)] pb-12">
          <Label className="tracking-[0.3em]">Session {roomCode}</Label>
          <h1 className="text-6xl md:text-8xl font-[var(--font-display)] leading-[0.8]">
            The Completed
            <br />
            Works
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {poems.map((poem, index) => (
            <Link
              key={poem._id}
              href={`/poem/${poem._id}`}
              className="group block h-full"
            >
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-2 transition-all duration-[var(--duration-normal)] h-full flex flex-col">
                <div className="mb-6 flex justify-between items-start">
                  <span className="font-mono text-[var(--text-xs)] text-[var(--color-text-muted)] border border-[var(--color-text-muted)] px-1.5 py-0.5 rounded-[2px]">
                    No. {(index + 1).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="flex-1">
                  <p className="text-[var(--text-2xl)] font-[var(--font-display)] italic leading-[var(--leading-relaxed)] text-[var(--color-text-primary)]">
                    &ldquo;{poem.preview}...&rdquo;
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-[var(--color-border-subtle)] text-right">
                  <span className="text-[var(--text-xs)] uppercase tracking-widest text-[var(--color-text-muted)] group-hover:underline transition-colors">
                    Read Full Text
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center pt-12">
          <Link
            href="/"
            className="text-[var(--text-sm)] font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Exit to Lobby
          </Link>
        </div>
      </div>
    </div>
  );
}
