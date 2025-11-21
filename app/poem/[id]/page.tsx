'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useParams } from 'next/navigation';
import { useUser } from '../../../lib/auth';
import { Button } from '../../../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import Link from 'next/link';
import { Id } from '../../../convex/_generated/dataModel';

export default function PoemDetailPage() {
  const params = useParams();
  const poemId = params.id as Id<'poems'>;
  const { guestToken } = useUser();
  const poemDetail = useQuery(api.poems.getPoemDetail, {
    poemId,
    guestToken: guestToken || undefined,
  });
  const isFavorited = useQuery(api.favorites.isFavorited, {
    poemId,
    guestToken: guestToken || undefined,
  });
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  if (!poemDetail) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="animate-pulse text-stone-500">Loading...</div>
      </div>
    );
  }

  const { lines } = poemDetail;

  const handleToggleFavorite = async () => {
    await toggleFavorite({ poemId, guestToken: guestToken || undefined });
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Link
            href="/"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]"
          >
            ← Home
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleFavorite}
            className={
              isFavorited
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)]'
            }
          >
            <svg
              className="w-6 h-6"
              fill={isFavorited ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </Button>
        </div>

        {/* Poem Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
            <CardTitle className="text-center">Poem</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {lines.map((line) => (
              <div
                key={line._id}
                className="transition-all duration-500 transform opacity-100 translate-y-0"
              >
                <p className="text-lg font-[var(--font-display)] text-[var(--color-text-primary)] text-center leading-relaxed">
                  {line.text}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] text-center mt-1">
                  — {line.authorName}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
