'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import { Palette } from 'lucide-react';
import { ThemeSelector } from './ThemeSelector';
import { Button } from './ui/Button';

type HeaderProps = {
  className?: string;
};

export function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const isRoomPage = pathname?.startsWith('/room/');
  const [showThemes, setShowThemes] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowThemes(false);
      }
    }

    if (showThemes) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showThemes]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowThemes(false);
      }
    }

    if (showThemes) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showThemes]);

  // Hide header entirely during game experience (Lobby → Writing → Reveal)
  if (isRoomPage) {
    return null;
  }

  return (
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

        {/* Theme selector dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowThemes(!showThemes)}
            className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
            aria-label="Choose theme"
            aria-expanded={showThemes}
            aria-haspopup="true"
          >
            <Palette className="w-5 h-5" />
          </button>

          {showThemes && (
            <div className="absolute top-full right-0 mt-2 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] z-50 w-[320px]">
              <ThemeSelector onClose={() => setShowThemes(false)} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
