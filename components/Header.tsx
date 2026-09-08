'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useAccountState } from '@/lib/account';
import { Archive, LogIn, MoreHorizontal } from 'lucide-react';
import { HelpModal } from './HelpModal';
import { Brand } from './Brand';
import { ColorModeControl } from './ColorModeControl';
import { isFocusedPlayRoute } from '@/lib/routes';

interface HeaderAuthBoundaryProps {
  children: ReactNode;
}

function DefaultSignedOut({ children }: HeaderAuthBoundaryProps) {
  const account = useAccountState();
  return account.kind === 'local' || (account.isLoaded && !account.user)
    ? children
    : null;
}

function DefaultSignedIn({ children }: HeaderAuthBoundaryProps) {
  const account = useAccountState();
  return account.kind === 'clerk' && account.isLoaded && account.user
    ? children
    : null;
}

function DefaultAccountButton() {
  return (
    <UserButton
      appearance={{
        elements: {
          rootBox: 'w-11 h-11 shrink-0',
          userButtonTrigger: 'w-11 h-11',
          avatarBox: 'w-10 h-10 border border-[var(--color-border)]',
        },
      }}
    />
  );
}

export interface HeaderDependencies {
  usePathname(): string;
  SignedOut: ComponentType<HeaderAuthBoundaryProps>;
  SignedIn: ComponentType<HeaderAuthBoundaryProps>;
  AccountButton: ComponentType;
}

const defaultHeaderDependencies: HeaderDependencies = {
  usePathname,
  SignedOut: DefaultSignedOut,
  SignedIn: DefaultSignedIn,
  AccountButton: DefaultAccountButton,
};

interface HeaderProps {
  className?: string;
  dependencies?: HeaderDependencies;
}

const headerIconClasses =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] transition-colors duration-[var(--duration-normal)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2';

const menuItemClasses =
  'flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-base font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-background)] focus-visible:outline-none focus-visible:bg-[var(--color-background)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]';

export function Header({
  className = '',
  dependencies = defaultHeaderDependencies,
}: HeaderProps) {
  const pathname = dependencies.usePathname();
  const { SignedOut, SignedIn, AccountButton } = dependencies;
  const isFocusedPlay = isFocusedPlayRoute(pathname);
  const isAuthPage = /^\/(sign-in|sign-up|callback)(?:\/|$)/.test(pathname);
  const [showHelp, setShowHelp] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!showMenu || isFocusedPlay || isAuthPage) return;

    firstMenuItemRef.current?.focus();
    const closeOutside = (event: Event) => {
      if (
        event.target instanceof Node &&
        !menuRootRef.current?.contains(event.target)
      ) {
        setShowMenu(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowMenu(false);
        menuTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu, isFocusedPlay, isAuthPage]);

  if (isFocusedPlay || isAuthPage) {
    return null;
  }

  return (
    <>
      <HelpModal
        isOpen={showHelp}
        onClose={() => {
          setShowHelp(false);
          menuTriggerRef.current?.focus();
        }}
      />
      <header className={`w-full px-4 py-3 sm:px-6 ${className}`}>
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
          <Link
            href="/"
            aria-label="Linejam"
            className="inline-flex min-h-11 min-w-0 items-center rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
          >
            <Brand className="text-xl min-[360px]:text-2xl" />
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <SignedOut>
              <Link
                href="/sign-in"
                className={headerIconClasses}
                aria-label="Sign in"
              >
                <LogIn className="h-5 w-5" aria-hidden="true" />
              </Link>
            </SignedOut>

            <SignedIn>
              <AccountButton />
            </SignedIn>

            <ColorModeControl />

            <div ref={menuRootRef} className="relative">
              <button
                ref={menuTriggerRef}
                type="button"
                onClick={() => setShowMenu((current) => !current)}
                className={headerIconClasses}
                aria-label="More options"
                aria-expanded={showMenu}
                aria-controls={menuId}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>

              {showMenu && (
                <nav
                  id={menuId}
                  aria-label="More options"
                  className="lj-room-popover absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-lg)]"
                >
                  <Link
                    ref={firstMenuItemRef}
                    href="/me/poems"
                    prefetch={false}
                    className={menuItemClasses}
                    onClick={() => setShowMenu(false)}
                  >
                    <Archive className="h-5 w-5 shrink-0" aria-hidden="true" />
                    Your poems
                  </Link>
                  <button
                    type="button"
                    className={menuItemClasses}
                    onClick={() => {
                      setShowMenu(false);
                      menuTriggerRef.current?.focus();
                      setShowHelp(true);
                    }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center text-lg"
                      aria-hidden="true"
                    >
                      ?
                    </span>
                    How to play
                  </button>
                </nav>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
