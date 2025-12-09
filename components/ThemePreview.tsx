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
  index?: number;
}

/**
 * Mini preview card showing a theme's visual style.
 * Uses inline CSS custom properties for preview isolation.
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

  // Inline CSS vars for preview isolation (doesn't affect rest of page)
  const previewStyle = {
    '--preview-bg': tokens['color-background'],
    '--preview-fg': tokens['color-foreground'],
    '--preview-primary': tokens['color-primary'],
    '--preview-surface': tokens['color-surface'],
    '--preview-border': tokens['color-border'],
    '--preview-text': tokens['color-text-primary'],
    '--preview-text-muted': tokens['color-text-muted'],
    '--preview-radius': tokens['radius-md'],
    '--preview-shadow': tokens['shadow-sm'],
  } as React.CSSProperties;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      tabIndex={tabIndex}
      style={previewStyle}
      className={cn(
        'relative p-4 rounded-lg border-2 transition-all duration-200 text-left w-full',
        'bg-[var(--preview-bg)] text-[var(--preview-text)]',
        'border-[var(--preview-border)]',
        isSelected && 'ring-2 ring-[var(--color-primary)] ring-offset-2',
        'hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
      )}
    >
      {/* Theme name */}
      <h3
        className="text-lg font-semibold mb-1"
        style={{ fontFamily: tokens['font-display'] }}
      >
        {theme.label}
      </h3>

      {/* Description */}
      <p className="text-sm mb-3" style={{ color: tokens['color-text-muted'] }}>
        {theme.description}
      </p>

      {/* Sample color swatches */}
      <div className="flex gap-2 mb-2">
        <div
          className="w-8 h-8"
          style={{
            backgroundColor: tokens['color-primary'],
            borderRadius: tokens['radius-md'],
          }}
        />
        <div
          className="w-8 h-8 border"
          style={{
            backgroundColor: tokens['color-surface'],
            borderColor: tokens['color-border'],
            borderRadius: tokens['radius-md'],
          }}
        />
        <div
          className="w-8 h-8"
          style={{
            backgroundColor: tokens['color-muted'],
            borderRadius: tokens['radius-md'],
          }}
        />
      </div>

      {/* Sample text with theme font */}
      <p
        className="text-xs"
        style={{
          fontFamily: tokens['font-sans'],
          color: tokens['color-text-secondary'],
        }}
      >
        The quick brown fox
      </p>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
      )}
    </button>
  );
}
