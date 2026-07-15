'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Palette, Archive, LogIn, MoreHorizontal } from 'lucide-react';
import { HelpModal } from './HelpModal';
import { isGameRoute } from '@/lib/routes';

type HeaderProps = {
  className?: string;
};

const headerIconClasses =
  'w-11 h-11 shrink-0 rounded-full border border-[var(--color-border)] items-center justify-center hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-[var(--duration-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2';

const mobileMenuItemClasses =
  'flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background)] focus-visible:outline-none focus-visible:bg-[var(--color-background)]';

export function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const isRoomPage = isGameRoute(pathname);
  const isAuthPage = /^\/(sign-in|sign-up|callback)(?:\/|$)/.test(pathname);
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showMenu) return;

    const handlePointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
        menuTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu]);

  // Gameplay and account entry own their focused chrome.
  if (isRoomPage || isAuthPage) {
    return null;
  }

  return (
    <>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <header
        className={`w-full px-3 py-3 sm:px-6 sm:py-6 flex justify-between items-center gap-2 border-b border-[var(--color-border-subtle)] ${className}`}
      >
        {/* Left: Wordmark (hidden on homepage) */}
        {!isHomepage && (
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center text-xl min-[360px]:text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-[var(--font-display)] text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            Linejam
          </Link>
        )}

        {/* Right: Auth + Theme */}
        <div className="flex shrink-0 items-center gap-1 min-[360px]:gap-2 sm:gap-4 ml-auto">
          <SignedOut>
            <Link
              href="/sign-in"
              className={`${headerIconClasses} flex`}
              aria-label="Sign in"
            >
              <LogIn className="w-5 h-5" />
            </Link>
          </SignedOut>

          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  rootBox: 'w-11 h-11 shrink-0',
                  userButtonTrigger: 'w-11 h-11',
                  avatarBox: 'w-10 h-10 border border-[var(--color-border)]',
                },
              }}
            />
          </SignedIn>

          {/* Archive link */}
          <Link
            href="/me/poems"
            prefetch={false}
            className={`${headerIconClasses} hidden sm:flex`}
            aria-label="View your poem archive"
          >
            <Archive className="w-5 h-5" />
          </Link>

          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className={`${headerIconClasses} hidden sm:flex`}
            aria-label="How to play"
          >
            <span className="text-lg font-medium">?</span>
          </button>

          {/* Theme collection page */}
          <Link
            href="/themes"
            prefetch={false}
            className={`${headerIconClasses} hidden sm:flex`}
            aria-label="Choose theme"
            aria-current={pathname === '/themes' ? 'page' : undefined}
          >
            <Palette className="w-5 h-5" />
          </Link>

          <div ref={menuRef} className="relative sm:hidden">
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setShowMenu((current) => !current)}
              className={`${headerIconClasses} flex`}
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={showMenu}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-3 w-56 max-w-[calc(100vw-1.5rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-lg)]">
                <Link
                  href="/me/poems"
                  prefetch={false}
                  className={mobileMenuItemClasses}
                  onClick={() => setShowMenu(false)}
                >
                  <Archive className="h-4 w-4 text-[var(--color-text-muted)]" />
                  Your poems
                </Link>
                <button
                  type="button"
                  className={mobileMenuItemClasses}
                  onClick={() => {
                    setShowMenu(false);
                    setShowHelp(true);
                  }}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center text-base text-[var(--color-text-muted)]"
                    aria-hidden="true"
                  >
                    ?
                  </span>
                  How to play
                </button>
                <Link
                  href="/themes"
                  prefetch={false}
                  className={mobileMenuItemClasses}
                  onClick={() => setShowMenu(false)}
                  aria-current={pathname === '/themes' ? 'page' : undefined}
                >
                  <Palette className="h-4 w-4 text-[var(--color-text-muted)]" />
                  Choose theme
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
