'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/Button';

type HeaderProps = {
  className?: string;
};

export function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  return (
    <header
      className={`w-full p-6 flex justify-between items-center gap-4 border-b border-[var(--color-border-subtle)] ${className}`}
    >
      {/* Left: Wordmark (hidden on homepage) */}
      {!isHomepage && (
        <Link
          href="/"
          className="text-2xl md:text-3xl font-[var(--font-display)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          Linejam
        </Link>
      )}

      {/* Right: Auth + Theme */}
      <div className="flex items-center gap-4 ml-auto">
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </SignInButton>
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

        <ThemeToggle />
      </div>
    </header>
  );
}
