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

const STORAGE_KEY_THEME = 'linejam-theme-id';
const STORAGE_KEY_MODE = 'linejam-theme-mode';

function installMatchMedia(initialMatches = false) {
  let changeListener: ((event: MediaQueryListEvent) => void) | null = null;
  const mediaQuery = {
    matches: initialMatches,
    addEventListener: vi.fn(
      (event: string, listener: (event: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          changeListener = listener;
        }
      }
    ),
    removeEventListener: vi.fn(() => {
      changeListener = null;
    }),
    dispatch(matches: boolean) {
      mediaQuery.matches = matches;
      changeListener?.({ matches } as MediaQueryListEvent);
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mediaQuery),
  });

  return mediaQuery;
}

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
        name: /mono theme: swiss modernism/i,
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
