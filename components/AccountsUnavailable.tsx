import Link from 'next/link';

export function AccountsUnavailable() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-sans font-bold text-[var(--color-text-primary)]">
          Accounts are not connected
        </h1>
        <p className="text-[var(--color-text-secondary)] font-sans">
          You can play as a guest in this local game.
        </p>
      </div>
      <p className="text-[var(--color-text-secondary)] font-sans text-sm">
        Your poems are stored in this local game. Keep this browser&apos;s guest
        session to return to them; they are not linked to an online account.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center justify-center px-6 py-3 bg-[var(--color-primary)] text-[var(--color-text-inverse)] rounded-[var(--radius-md)] font-sans font-semibold hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-focus-ring)]"
      >
        Play as guest
      </Link>
    </div>
  );
}
