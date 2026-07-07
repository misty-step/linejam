/**
 * ArchiveInfoStrip
 *
 * The archive page's one persistent, low-key info line. Reuses the exact
 * hairline-hint convention the page already used for signed-in users
 * ("Tap any poem to reveal the full verse") and layers in a guest-specific
 * line explaining what signing in adds — chosen over 9 other structural
 * directions in explorations/guest-archive-identity-lab (see DECISION.md
 * there) specifically because it is always visible, never a modal or
 * redirect, and matches an existing pattern instead of inventing new
 * chrome.
 *
 * linejam-942: the archive entry point must never dead-end on a bare auth
 * wall — a guest sees this even with zero poems.
 */

'use client';

import Link from 'next/link';

type ArchiveInfoStripProps = {
  isAuthenticated: boolean;
  hasPoems: boolean;
};

export function ArchiveInfoStrip({
  isAuthenticated,
  hasPoems,
}: ArchiveInfoStripProps) {
  const showRevealHint = hasPoems;
  const showGuestNote = !isAuthenticated;

  if (!showRevealHint && !showGuestNote) {
    return null;
  }

  return (
    <div className="mt-8 py-4 border-y border-[var(--color-border-subtle)] space-y-1.5">
      {showRevealHint && (
        <p className="text-sm text-[var(--color-text-muted)] font-mono">
          Tap any poem to reveal the full verse
        </p>
      )}
      {showGuestNote && (
        <p className="text-sm text-[var(--color-text-muted)] font-mono">
          Saved to this browser only.{' '}
          <Link
            href="/sign-up"
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline underline-offset-2"
          >
            Sign up
          </Link>{' '}
          to keep it forever, on any device.
        </p>
      )}
    </div>
  );
}
