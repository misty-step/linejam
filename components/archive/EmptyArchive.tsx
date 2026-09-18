import Link from 'next/link';

interface EmptyArchiveProps {
  variant?: 'default' | 'filtered';
}

export function EmptyArchive({ variant = 'default' }: EmptyArchiveProps) {
  if (variant === 'filtered') {
    return (
      <div className="py-10 text-left">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          No poems match your search
        </h2>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Try adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg py-8 text-left">
      <h2 className="mb-3 text-2xl font-sans font-bold text-[var(--color-text-primary)]">
        Your first poem starts with friends.
      </h2>
      <p className="mb-6 leading-relaxed text-[var(--color-text-secondary)]">
        Every poem you help write will appear here.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/host"
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]"
        >
          Start a game
        </Link>
        <Link
          href="/join"
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
        >
          Join a room
        </Link>
      </div>
    </div>
  );
}
