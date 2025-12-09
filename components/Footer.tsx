type FooterProps = {
  className?: string;
};

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer
      className={`w-full bg-[var(--color-background)] border-t border-[var(--color-border-subtle)] ${className}`}
    >
      <div className="max-w-[var(--spacing-container)] mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4 text-xs font-[var(--font-sans)] text-[var(--color-text-muted)]">
        <div className="flex items-center gap-4">
          <span className="font-medium text-[var(--color-text-secondary)]">
            Linejam
          </span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://mistystep.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-primary)] transition-colors"
          >
            A Misty Step project
          </a>
        </div>
      </div>
    </footer>
  );
}
