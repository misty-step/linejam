'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUser } from '../../../lib/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import Link from 'next/link';

export default function MyPoemsPage() {
  const { guestId, isLoading } = useUser();

  // We need userId for the query.
  // The backend `getPoemsForUser` expects a user ID.
  // But we only have clerkId or guestId on the client.
  // We can't easily get the internal Convex ID without a query.
  // Let's assume we can pass the clerk/guest ID to the query or use a wrapper.
  // Actually, let's update the backend query to accept clerk/guest ID or handle it internally like `getUser`.
  // But `getPoemsForUser` in `poems.ts` currently takes `v.id("users")`.
  // I should update `poems.ts` to be more flexible or add a `getMyPoems` query that uses auth context.
  // Let's update `poems.ts` in the next step. For now, I'll write the component assuming a `getMyPoems` query exists.

  const poems = useQuery(api.poems.getMyPoems, {
    guestId: guestId || undefined,
  });

  const favorites = useQuery(api.favorites.getMyFavorites, {
    guestId: guestId || undefined,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">My Collection</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
            Home
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Favorites</h2>
          {favorites && favorites.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((poem) => (
                <Link key={poem._id} href={`/poem/${poem._id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-500">
                        {new Date(poem.favoritedAt).toLocaleDateString()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-900 italic line-clamp-3">
                        &ldquo;{poem.preview}...&rdquo;
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No favorites yet.</p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Past Games</h2>
          {poems && poems.length > 0 ? (
            <div className="space-y-2">
              {poems.map((poem) => (
                <Link key={poem._id} href={`/poem/${poem._id}`}>
                  <div className="block bg-white border border-gray-200 px-4 py-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">
                        Game on{' '}
                        {new Date(
                          poem.roomDate || poem.createdAt
                        ).toLocaleDateString()}
                      </span>
                      <span className="text-sm text-gray-500">View Poem →</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 truncate">
                      &ldquo;{poem.preview}...&rdquo;
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No games played yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
