'use client';

import Link from 'next/link';
import { Button } from '../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/Card';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Linejam
          </h1>
          <p className="text-lg text-gray-600">
            Collaborative poetry for friends in the same room.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/host" className="block w-full">
              <Button className="w-full" size="lg">
                Host a Game
              </Button>
            </Link>
            <Link href="/join" className="block w-full">
              <Button variant="secondary" className="w-full" size="lg">
                Join a Game
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/me/poems"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            View My Poems
          </Link>
        </div>
      </div>
    </div>
  );
}
