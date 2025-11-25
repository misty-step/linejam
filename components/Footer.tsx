import Link from 'next/link';
import { Divider } from './ui/Divider';

type FooterProps = {
  className?: string;
};

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer
      className={`w-full p-8 text-center space-y-3 bg-[var(--color-background)] ${className}`}
    >
      <div aria-hidden="true">
        <Divider className="max-w-[120px] mx-auto text-[var(--color-text-muted)] opacity-40" />
      </div>

      <div className="space-y-2">
        <div>
          <a
            href="https://mistystep.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors font-[var(--font-sans)]"
          >
            A Misty Step project
          </a>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-[var(--color-text-muted)] font-[var(--font-sans)]">
          <Link
            href="/me/poems"
            className="hover:text-[var(--color-primary)] transition-colors"
          >
            Archive
          </Link>
          <span>·</span>
          <span>Est. 2025</span>
        </div>
      </div>
    </footer>
  );
}
