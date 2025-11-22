'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/Button';

interface PoemDisplayProps {
  lines: string[];
  onDone: () => void;
  alreadyRevealed?: boolean;
}

export function PoemDisplay({
  lines,
  onDone,
  alreadyRevealed = false,
}: PoemDisplayProps) {
  const [revealedCount, setRevealedCount] = useState(
    alreadyRevealed ? lines.length : 0
  );

  // Staggered reveal animation
  useEffect(() => {
    if (!alreadyRevealed && revealedCount < lines.length) {
      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, lines.length, alreadyRevealed]);

  const allRevealed = revealedCount >= lines.length;

  return (
    <div className="fixed inset-0 bg-[var(--color-background)] z-50 flex flex-col items-center justify-center p-8 md:p-12 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-12 relative z-10 my-auto">
        {/* The Poem */}
        <div className="space-y-6 flex flex-col justify-center">
          {lines.map((line, index) => {
            const isVisible = index < revealedCount;

            return (
              <div
                key={index}
                className={`transition-all duration-800 transform ${
                  isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
              >
                <p className="text-3xl md:text-4xl lg:text-5xl font-[var(--font-display)] leading-tight text-[var(--color-text-primary)]">
                  {line}
                </p>
              </div>
            );
          })}
        </div>

        {/* Done button */}
        <div
          className={`text-center transition-opacity duration-1000 ${allRevealed ? 'opacity-100' : 'opacity-0'}`}
        >
          <Button
            onClick={onDone}
            variant="outline"
            size="lg"
            className="min-w-[200px] border-2 h-16 text-lg"
          >
            Close Ledger
          </Button>
        </div>
      </div>
    </div>
  );
}
