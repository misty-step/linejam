'use client';

import { visibleThemeIds, getTheme } from '@/lib/themes';
import { useThemeRadioNav } from '@/hooks/useThemeRadioNav';
import { ThemeModeControl } from '@/components/ThemeModeControl';
import { ThemeSpecimenCard } from '@/components/ThemeSpecimenCard';

/**
 * /themes — the theme collection as a first-class page.
 *
 * A type-specimen book: every theme previews as a real poem line set in its
 * own paper, ink, and display face. Selection applies immediately (the whole
 * app is the confirmation). Design locked from the 2026-07 design lab
 * (SELECTOR section winner, ANTHRO-6 "Specimen").
 */
export default function ThemesPage() {
  const { themeId, mode, setTheme, listRef, tabAnchorId, handleKeyDown } =
    useThemeRadioNav();
  const activeTheme = getTheme(themeId);

  return (
    <main
      className="max-w-xl mx-auto px-4 pt-6 pb-16"
      data-testid="themes-page"
    >
      <header className="mb-6">
        <p className="text-[var(--text-xs)] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)] font-[family-name:var(--font-mono)]">
          Linejam · Themes
        </p>
        <h1 className="mt-1 text-[var(--text-2xl)] leading-[var(--leading-tight)] font-[family-name:var(--font-display)] text-[var(--color-text-primary)]">
          Pick a look
        </h1>
        <p className="mt-2 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
          {visibleThemeIds.length} themes.{' '}
          <strong className="text-[var(--color-text-primary)]">
            {activeTheme?.label ?? themeId}
          </strong>{' '}
          is on now.
        </p>
      </header>

      <ThemeModeControl className="mb-6" />

      <div
        ref={listRef}
        className="flex flex-col gap-3"
        role="radiogroup"
        aria-label="Select theme"
        onKeyDown={handleKeyDown}
      >
        {visibleThemeIds.map((id) => (
          <ThemeSpecimenCard
            key={id}
            themeId={id}
            isSelected={id === themeId}
            currentMode={mode}
            onSelect={() => setTheme(id)}
            tabIndex={id === tabAnchorId ? 0 : -1}
          />
        ))}
      </div>
    </main>
  );
}
