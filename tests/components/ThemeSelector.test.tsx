// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ThemeSelector } from '@/components/ThemeSelector';
import { ThemePreview } from '@/components/ThemePreview';
import { ThemeProvider } from '@/lib/themes';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

const STORAGE_KEY_THEME = 'linejam-theme-id';
const STORAGE_KEY_MODE = 'linejam-theme-mode';

function renderThemeSelector(props: { onClose?: () => void } = {}) {
  return render(
    <ThemeProvider>
      <ThemeSelector {...props} />
    </ThemeProvider>
  );
}

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('persists mode and theme selections through the provider', () => {
    installMatchMedia(false);

    renderThemeSelector();

    fireEvent.click(screen.getByRole('tab', { name: /dark/i }));
    fireEvent.click(
      screen.getByRole('radio', {
        name: /hyper theme: digital chaos & brutalism/i,
      })
    );

    expect(localStorage.getItem(STORAGE_KEY_MODE)).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe('hyper');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('hyper');
    expect(
      screen.getByRole('radio', {
        name: /hyper theme: digital chaos & brutalism/i,
      })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('lets color modes wrap without overflowing a narrow scaled popover', () => {
    installMatchMedia(false);

    renderThemeSelector();

    const modeControl = screen.getByRole('tablist', { name: /color mode/i });
    expect(modeControl).toHaveClass('flex-wrap', 'min-w-0', 'max-w-full');

    for (const mode of ['light', 'dark', 'system']) {
      expect(
        screen.getByRole('tab', { name: new RegExp(mode, 'i') })
      ).toHaveClass('min-w-[min(100%,4.75rem)]', 'flex-[1_1_4.75rem]');
    }
  });

  it('supports keyboard navigation and closes on Escape', () => {
    installMatchMedia(false);
    const onClose = vi.fn();

    renderThemeSelector({ onClose });

    const radiogroup = screen.getByRole('radiogroup', {
      name: /select theme/i,
    });

    fireEvent.keyDown(radiogroup, { key: 'End' });
    expect(
      screen.getByRole('radio', {
        name: /hyper theme: digital chaos & brutalism/i,
      })
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(radiogroup, { key: 'Home' });
    expect(
      screen.getByRole('radio', {
        name: /kenya theme: japanese editorial minimalism/i,
      })
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(radiogroup, { key: 'ArrowDown' });
    expect(
      screen.getByRole('radio', {
        name: /the fold theme: folded manuscript, quiet ink/i,
      })
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(radiogroup, { key: 'ArrowUp' });
    expect(
      screen.getByRole('radio', {
        name: /kenya theme: japanese editorial minimalism/i,
      })
    ).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(radiogroup, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults and tracks system preference changes', async () => {
    const mediaQuery = installMatchMedia(false);
    localStorage.setItem(STORAGE_KEY_THEME, 'not-a-theme');
    localStorage.setItem(STORAGE_KEY_MODE, 'invalid');

    renderThemeSelector();

    expect(
      screen.getByRole('tab', {
        name: /system/i,
      })
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('radio', {
        name: /kenya theme: japanese editorial minimalism/i,
      })
    ).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.classList.contains('light')).toBe(true);

    await act(async () => {
      mediaQuery.dispatch(true);
    });

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('returns null for unknown theme previews', () => {
    const { container } = render(
      <ThemePreview
        themeId="missing-theme"
        isSelected={false}
        currentMode="light"
        onSelect={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
