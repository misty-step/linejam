import Link from 'next/link';
import { Brand } from '@/components/Brand';

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--color-background)] px-5 py-12">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8">
        <Brand />
        <div className="space-y-3">
          <h1 className="text-3xl font-sans font-bold text-[var(--color-text-primary)]">
            Page not found
          </h1>
          <p className="leading-relaxed text-[var(--color-text-secondary)]">
            Check the link, or head home to start a game.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-12 self-start items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
