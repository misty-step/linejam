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
    return <div className="flex justify-center p-8">Loading poems...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            All Poems Complete!
          </h1>
          <p className="text-lg text-gray-600">
            Tap a card to reveal the full poem.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {poems.map((poem, index) => (
            <Link key={poem._id} href={`/poem/${poem._id}`}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>Poem #{index + 1}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 italic line-clamp-3">
                    &ldquo;{poem.preview}...&rdquo;
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
