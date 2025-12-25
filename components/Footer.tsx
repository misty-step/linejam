'use client';

import { useState } from 'react';
import { HelpModal } from './HelpModal';

type FooterProps = {
  className?: string;
};

export function Footer({ className = '' }: FooterProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <footer
        className={`w-full bg-[var(--color-background)] border-t border-[var(--color-border-subtle)] ${className}`}
      >
        <div className="flex items-center justify-center gap-3 px-4 py-3 text-[10px] font-mono uppercase tracking-wide text-[var(--color-text-muted)]">
          <button
            onClick={() => setShowHelp(true)}
            className="hover:text-[var(--color-primary)] transition-colors"
          >
            HELP
          </button>
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
    </>
  );
}
