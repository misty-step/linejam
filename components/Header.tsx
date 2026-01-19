'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Palette, Archive, LogIn } from 'lucide-react';
import { HelpModal } from './HelpModal';
import { ThemeSelector } from './ThemeSelector';

type HeaderProps = {
  className?: string;
};

export function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const isRoomPage = pathname?.startsWith('/room/');
  const [showThemes, setShowThemes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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
              className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
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
            className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
            aria-label="View your poem archive"
          >
            <Archive className="w-5 h-5" />
          </Link>

          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)]"
            aria-label="How to play"
          >
            <span className="text-lg font-medium">?</span>
          </button>

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
    </>
  );
}
