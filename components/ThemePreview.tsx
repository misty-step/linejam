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
            className="font-semibold truncate"
            style={{
              fontFamily: tokens['font-display'],
              color: tokens['color-text-primary'],
              fontSize: tokens['text-base'],
            }}
          >
            {theme.label}
          </h3>

          {/* Description - truncated to single line */}
          <p
            className="truncate"
            style={{
              fontFamily: tokens['font-sans'],
              color: tokens['color-text-secondary'],
              fontSize: tokens['text-sm'],
            }}
          >
            {theme.description}
          </p>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: tokens['color-primary'] }}
          >
            <Check
              className="w-3 h-3"
              style={{ color: tokens['color-text-inverse'] }}
            />
          </div>
        )}
      </div>
    </button>
  );
}
