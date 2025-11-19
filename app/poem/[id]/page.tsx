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
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Id } from '../../../convex/_generated/dataModel';

export default function PoemDetailPage() {
  const params = useParams();
  const poemId = params.id as Id<'poems'>;
  const { guestId } = useUser();

  const poemData = useQuery(api.poems.getPoemDetail, { poemId });
  const isFavorited = useQuery(api.favorites.isFavorited, {
    poemId,
    guestId: guestId || undefined,
  });
  const toggleFavorite = useMutation(api.favorites.toggleFavorite);

  const [revealedLines, setRevealedLines] = useState<number>(0);

  // Staggered reveal effect
  useEffect(() => {
    if (poemData?.lines) {
      const interval = setInterval(() => {
        setRevealedLines((prev) => {
          if (prev < poemData.lines.length) return prev + 1;
          clearInterval(interval);
          return prev;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [poemData?.lines]);

  if (!poemData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const handleFavorite = async () => {
    await toggleFavorite({ poemId, guestId: guestId || undefined });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
            ← Home
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFavorite}
            className={isFavorited ? 'text-red-500' : 'text-gray-400'}
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

        <Card className="overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-100">
            <CardTitle className="text-center">Poem</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            {poemData.lines.map((line, index) => (
              <div
                key={line._id}
                className={`transition-all duration-500 transform ${
                  index < revealedLines
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                }`}
              >
                <p className="text-lg font-serif text-gray-900 text-center leading-relaxed">
                  {line.text}
                </p>
                <p className="text-xs text-gray-400 text-center mt-1">
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
