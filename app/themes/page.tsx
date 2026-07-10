'use client';

import { useRef, useCallback } from 'react';
import { useTheme, visibleThemeIds, getTheme } from '@/lib/themes';
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
  const { themeId, mode, setTheme } = useTheme();
  const listRef = useRef<HTMLDivElement>(null);
  const activeTheme = getTheme(themeId);
  // A retired active theme (saved before the top-10 roster) renders no card;
  // anchor the roving tabindex on the first card so keyboard users can enter.
  const tabAnchorId = visibleThemeIds.includes(themeId)
    ? themeId
    : visibleThemeIds[0];

  const focusCard = useCallback((index: number) => {
    const cards = listRef.current?.querySelectorAll('[role="radio"]');
    (cards?.[index] as HTMLElement)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const currentIndex = visibleThemeIds.indexOf(themeId);
      const move = (nextIndex: number) => {
        event.preventDefault();
        setTheme(visibleThemeIds[nextIndex]);
        focusCard(nextIndex);
      };
      switch (event.key) {
        case 'ArrowDown':
          move((currentIndex + 1) % visibleThemeIds.length);
          break;
        case 'ArrowUp':
          move(
            (currentIndex - 1 + visibleThemeIds.length) % visibleThemeIds.length
          );
          break;
        case 'Home':
          move(0);
          break;
        case 'End':
          move(visibleThemeIds.length - 1);
          break;
      }
    },
    [themeId, setTheme, focusCard]
  );

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
