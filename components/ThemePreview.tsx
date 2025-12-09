'use client';

import { Check } from 'lucide-react';
import type { ThemeMode } from '@/lib/themes';
import { getTheme } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface ThemePreviewProps {
  themeId: string;
  isSelected: boolean;
  currentMode: ThemeMode;
  onSelect: () => void;
  tabIndex?: number;
}

/**
 * Self-styling theme row.
 * The row itself IS the preview - rendered using that theme's own tokens.
 */
export function ThemePreview({
  themeId,
  isSelected,
  currentMode,
  onSelect,
  tabIndex = 0,
}: ThemePreviewProps) {
  const theme = getTheme(themeId);
  if (!theme) return null;

  const tokens = theme.tokens[currentMode];

  // Inline CSS vars for complete preview isolation
  const rowStyle = {
    '--preview-bg': tokens['color-surface'],
    '--preview-border': tokens['color-border'],
    '--preview-text': tokens['color-text-primary'],
    '--preview-text-muted': tokens['color-text-secondary'],
    '--preview-radius': tokens['radius-md'],
    '--preview-primary': tokens['color-primary'],
    '--preview-shadow': tokens['shadow-sm'],
  } as React.CSSProperties;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={`${theme.label} theme: ${theme.description}`}
      onClick={onSelect}
      tabIndex={tabIndex}
      style={rowStyle}
      className={cn(
        // Layout
        'relative w-full px-4 py-3 text-left',
        // Self-styling with theme tokens
        'bg-[var(--preview-bg)]',
        'border border-[var(--preview-border)]',
        'rounded-[var(--preview-radius)]',
        // Transitions
        'transition-all duration-[var(--duration-normal)]',
        // Selection state
        isSelected &&
          'ring-2 ring-[var(--preview-primary)] ring-offset-2 ring-offset-[var(--color-background)]',
        // Hover/focus
        'hover:shadow-[var(--preview-shadow)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--preview-primary)]'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Theme name - uses theme's display font */}
          <h3
            className="font-semibold leading-normal"
            style={{
              fontFamily: tokens['font-display'],
              color: tokens['color-text-primary'],
              fontSize: tokens['text-base'],
            }}
          >
            {theme.label}
          </h3>

          {/* Description - full text, natural wrapping */}
          <p
            className="leading-normal"
            style={{
              fontFamily: tokens['font-sans'],
              color: tokens['color-text-secondary'],
              fontSize: tokens['text-sm'],
            }}
          >
            {theme.description}
          </p>
        </div>

        {/* Color palette swatches with selection indicator on first */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {[
            tokens['color-primary'],
            tokens['color-background'],
            tokens['color-surface'],
            tokens['color-text-primary'],
          ].map((color, i) => (
            <span
              key={i}
              className="relative w-2.5 h-2.5 rounded-full border border-black/10 flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              {/* Checkmark overlay on first swatch when selected */}
              {i === 0 && isSelected && (
                <Check
                  className="w-2 h-2"
                  style={{ color: tokens['color-text-inverse'] }}
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
