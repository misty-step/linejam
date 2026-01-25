import Link from 'next/link';

type FooterProps = {
  className?: string;
};

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer
      className={`w-full bg-[var(--color-background)] border-t border-[var(--color-border-subtle)] ${className}`}
    >
      <div className="flex items-center justify-center gap-3 px-4 py-3 text-[10px] font-mono uppercase tracking-wide text-[var(--color-text-muted)]">
        <Link
          href="/releases"
          className="hover:text-[var(--color-primary)] transition-colors"
        >
          Releases
        </Link>
        <span className="text-[var(--color-border)]">·</span>
        <span>LINEJAM © {new Date().getFullYear()}</span>
        <span className="text-[var(--color-border)]">·</span>
        <a
          href="https://mistystep.io"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--color-primary)] transition-colors"
        >
          A MISTY STEP PROJECT
        </a>
      </div>
    </footer>
  );
}
