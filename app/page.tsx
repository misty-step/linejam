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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-6">
      <div className="max-w-sm w-full space-y-10 animate-stagger">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl sm:text-6xl tracking-tight">Linejam</h1>
          <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
            Collaborative poetry for friends in the same room.
          </p>
        </div>

        {/* Action Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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

        {/* Footer Link */}
        <div className="text-center">
          <Link
            href="/me/poems"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors duration-[var(--duration-fast)]"
          >
            View My Poems
          </Link>
        </div>
      </div>
    </div>
  );
}
