'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isFocusedPlayRoute } from '@/lib/routes';

type FooterProps = {
  className?: string;
};

export function Footer({ className = '' }: FooterProps) {
  const pathname = usePathname();

  // Host, join, and room routes are focused play surfaces. Marketing and legal
  // chrome would dilute the primary action and consume scarce mobile height.
  if (isFocusedPlayRoute(pathname)) {
    return null;
  }

  return (
    <footer className={`w-full bg-[var(--color-background)] ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-4 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        <span>© {new Date().getFullYear()} Linejam</span>
        <Link
          href="/releases"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
        >
          Releases
        </Link>
        <a
          href="https://mistystep.io"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2"
        >
          Made by Misty Step
        </a>
      </div>
    </footer>
  );
}
