import Link from 'next/link';

type ArchiveInfoStripProps = {
  isAuthenticated: boolean;
  accountsAvailable: boolean;
};

/** Guest access belongs to this browser, even before the first poem exists. */
export function ArchiveInfoStrip({
  isAuthenticated,
  accountsAvailable,
}: ArchiveInfoStripProps) {
  if (isAuthenticated) return null;

  return (
    <p className="mt-5 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
      Your guest poems are linked to this browser.{' '}
      {accountsAvailable ? (
        <>
          <Link
            href="/sign-up"
            className="inline-flex min-h-11 items-center text-[var(--color-primary)] underline underline-offset-4 hover:text-[var(--color-primary-hover)]"
          >
            Sign up
          </Link>{' '}
          to access them on other devices.
        </>
      ) : (
        'Keep this guest session to return to them. Accounts are not connected in this local game.'
      )}
    </p>
  );
}
