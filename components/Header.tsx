'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Palette, Archive, LogIn } from 'lucide-react';
import { HelpModal } from './HelpModal';
import { isGameRoute } from '@/lib/routes';

type HeaderProps = {
  className?: string;
};

export function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const isRoomPage = isGameRoute(pathname);
  const [showHelp, setShowHelp] = useState(false);

  // Hide header entirely during game experience (Lobby → Writing → Reveal)
  if (isRoomPage) {
    return null;
  }

  return (
    <>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <header
        className={`w-full p-6 flex justify-between items-center gap-4 border-b border-[var(--color-border-subtle)] ${className}`}
      >
        {/* Left: Wordmark (hidden on homepage) */}
        {!isHomepage && (
          <Link
            href="/"
            className="text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-[var(--font-display)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Linejam
          </Link>
        )}

        {/* Right: Auth + Theme */}
        <div className="flex items-center gap-4 ml-auto">
          <SignedOut>
            <Link
              href="/sign-in"
              className="w-11 h-11 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
              aria-label="Sign in"
            >
              <LogIn className="w-5 h-5" />
            </Link>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-10 h-10 border border-[var(--color-border)]',
                },
              }}
            />
          </SignedIn>

          {/* Archive link */}
          <Link
            href="/me/poems"
            prefetch={false}
            className="w-11 h-11 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
            aria-label="View your poem archive"
          >
            <Archive className="w-5 h-5" />
          </Link>

          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className="w-11 h-11 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
            aria-label="How to play"
          >
            <span className="text-lg font-medium">?</span>
          </button>

          {/* Theme collection page */}
          <Link
            href="/themes"
            prefetch={false}
            className="w-11 h-11 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
            aria-label="Choose theme"
            aria-current={pathname === '/themes' ? 'page' : undefined}
          >
            <Palette className="w-5 h-5" />
          </Link>
        </div>
      </header>
    </>
  );
}
