'use client';

import { Check } from 'lucide-react';
import type { ThemeId, ThemeMode } from '@/lib/themes';
import { getTheme } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface ThemePreviewProps {
  themeId: ThemeId;
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
  const styles = theme.styles[currentMode];

  // Inline CSS vars for preview isolation (doesn't affect rest of page)
  const previewStyle = {
    '--preview-bg': styles.colors.background,
    '--preview-fg': styles.colors.foreground,
    '--preview-primary': styles.colors.primary,
    '--preview-surface': styles.colors.surface,
    '--preview-border': styles.colors.border,
    '--preview-text': styles.colors.textPrimary,
    '--preview-text-muted': styles.colors.textMuted,
    '--preview-radius': styles.radius.md,
    '--preview-shadow': styles.shadows.sm,
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
        style={{ fontFamily: styles.fonts.display }}
      >
        {theme.label}
      </h3>

      {/* Description */}
      <p className="text-sm mb-3" style={{ color: styles.colors.textMuted }}>
        {theme.description}
      </p>

      {/* Sample color swatches */}
      <div className="flex gap-2 mb-2">
        <div
          className="w-8 h-8"
          style={{
            backgroundColor: styles.colors.primary,
            borderRadius: styles.radius.md,
          }}
        />
        <div
          className="w-8 h-8 border"
          style={{
            backgroundColor: styles.colors.surface,
            borderColor: styles.colors.border,
            borderRadius: styles.radius.md,
          }}
        />
        <div
          className="w-8 h-8"
          style={{
            backgroundColor: styles.colors.muted,
            borderRadius: styles.radius.md,
          }}
        />
      </div>

      {/* Sample text with theme font */}
      <p
        className="text-xs"
        style={{
          fontFamily: styles.fonts.sans,
          color: styles.colors.textSecondary,
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
