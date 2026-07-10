'use client';

import { Check } from 'lucide-react';
import type { ThemeMode } from '@/lib/themes';
import { getTheme } from '@/lib/themes';
import { cn } from '@/lib/utils';

/** The canonical specimen line every theme sets in its own voice. */
const SPECIMEN_LINE = 'moonlight over quiet stones';

interface ThemeSpecimenCardProps {
  themeId: string;
  isSelected: boolean;
  currentMode: ThemeMode;
  onSelect: () => void;
  tabIndex?: number;
}

/**
 * Type-specimen theme card: a real poem line rendered entirely in the
 * candidate theme's own tokens (paper, ink, display face, accent seal),
 * with a name row beneath. The card IS the preview — chrome stays neutral
 * so every theme's colors read truthfully. Winner of the 2026-07 design
 * lab's theme-selector bench (ANTHRO-6 "Specimen").
 */
export function ThemeSpecimenCard({
  themeId,
  isSelected,
  currentMode,
  onSelect,
  tabIndex = 0,
}: ThemeSpecimenCardProps) {
  const theme = getTheme(themeId);
  if (!theme) return null;

  const tokens = theme.tokens[currentMode];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${theme.label} theme: ${theme.description}`}
      data-testid={`theme-specimen-${themeId}`}
      onClick={onSelect}
      tabIndex={tabIndex}
      className={cn(
        'relative w-full text-left overflow-hidden',
        'rounded-[var(--radius-lg)] border',
        'transition-all duration-[var(--duration-normal)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]',
        isSelected
          ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
      )}
    >
      {/* Specimen stage: the theme's own paper, ink, and display face */}
      <div
        className="relative px-5 pt-5 pb-4"
        style={{ backgroundColor: tokens['color-background'] }}
      >
        <span
          aria-hidden
          className="absolute top-4 right-4 w-3.5 h-3.5 rounded-full"
          style={{ backgroundColor: tokens['color-primary'] }}
        />
        <p
          className="pr-7 text-[1.35rem] leading-snug"
          style={{
            fontFamily: tokens['font-display'],
            color: tokens['color-text-primary'],
          }}
        >
          {SPECIMEN_LINE}
        </p>
        <p
          className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em]"
          style={{
            fontFamily: tokens['font-mono'],
            color: tokens['color-primary'],
          }}
        >
          A line in {theme.label}
        </p>
      </div>

      {/* Name row: neutral surface so the stage above reads as the preview */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-[var(--color-surface)] border-t border-[var(--color-border-subtle)]">
        <div className="min-w-0">
          <span className="block font-semibold text-[var(--text-base)] text-[var(--color-text-primary)]">
            {theme.label}
          </span>
          <span className="block text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            {theme.description}
          </span>
        </div>
        <span
          className={cn(
            'flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center',
            'transition-all duration-[var(--duration-normal)]',
            isSelected
              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-text-inverse)]'
              : 'border-[var(--color-border)] text-transparent'
          )}
        >
          <Check className="w-4 h-4" />
        </span>
      </div>
    </button>
  );
}
