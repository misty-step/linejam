import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Link from 'next/link';

interface RevealListProps {
  roomCode: string;
}

export function RevealList({ roomCode }: RevealListProps) {
  const poems = useQuery(api.poems.getPoemsForRoom, { roomCode });

  if (!poems) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <span className="text-[var(--color-text-muted)]">Loading poems...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6">
      <div className="max-w-4xl mx-auto space-y-10 animate-stagger">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl tracking-tight">
            All Poems Complete
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)]">
            Tap a card to reveal the full poem.
          </p>
        </div>

        {/* Poem Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {poems.map((poem, index) => (
            <Link key={poem._id} href={`/poem/${poem._id}`}>
              <Card className="h-full hover:shadow-[var(--shadow-md)] transition-shadow duration-[var(--duration-base)] cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">Poem #{index + 1}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[var(--color-text-muted)] italic line-clamp-3 font-[var(--font-display)]">
                    &ldquo;{poem.preview}...&rdquo;
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
