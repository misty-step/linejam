'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/Button';

interface PoemDisplayProps {
  poemNumber: number;
  lines: string[];
  onDone: () => void;
}

export function PoemDisplay({ poemNumber, lines, onDone }: PoemDisplayProps) {
  const [revealedCount, setRevealedCount] = useState(0);

  // Staggered reveal animation
  useEffect(() => {
    if (revealedCount < lines.length) {
      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, lines.length]);

  const allRevealed = revealedCount >= lines.length;

  return (
    <div className="fixed inset-0 bg-[var(--color-background)] z-50 flex flex-col items-center justify-center p-6">
      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, var(--color-background) 100%)',
          opacity: 0.3,
        }}
      />

      <div className="max-w-lg w-full text-center space-y-8 relative z-10">
        {/* Poem number */}
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Poem {poemNumber}
        </p>

        {/* Lines */}
        <div className="space-y-4 min-h-[300px] flex flex-col justify-center">
          {lines.map((line, index) => {
            const isVisible = index < revealedCount;
            const isDimmed =
              isVisible && index < revealedCount - 1 && !allRevealed;

            return (
              <p
                key={index}
                className="text-xl sm:text-2xl md:text-3xl font-[var(--font-display)] leading-relaxed text-[var(--color-text-primary)] transition-all duration-500"
                style={{
                  opacity: isVisible ? (isDimmed ? 0.6 : 1) : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(1rem)',
                }}
              >
                {line}
              </p>
            );
          })}
        </div>

        {/* Done button */}
        {allRevealed && (
          <div className="animate-fade-in pt-8">
            <Button onClick={onDone} variant="secondary" size="lg">
              Done Reading
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
