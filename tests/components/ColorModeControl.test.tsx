// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ColorModeControl } from '@/components/ColorModeControl';
import { ColorModeProvider } from '@/lib/colorMode';
import { COLOR_MODE_STORAGE_KEY } from '@/lib/colorMode/constants';
import { installMatchMedia } from '@/tests/helpers/matchMedia';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

function renderColorModeControl() {
  return render(
    <ColorModeProvider>
      <ColorModeControl />
    </ColorModeProvider>
  );
}

describe('ColorModeControl', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    installMatchMedia(false);
  });

  it('cycles System, Light, Dark, and back with keyboard activation', async () => {
    const user = userEvent.setup();
    renderColorModeControl();
    const control = screen.getByRole('button', {
      name: /color mode: system.*switch to light/i,
    });
    await user.tab();
    expect(control).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(control).toHaveAccessibleName(/color mode: light.*switch to dark/i);
    expect(document.documentElement).toHaveClass('light');

    await user.keyboard(' ');
    expect(control).toHaveAccessibleName(/color mode: dark.*switch to system/i);
    expect(document.documentElement).toHaveClass('dark');

    await user.keyboard('{Enter}');
    expect(control).toHaveAccessibleName(
      /color mode: system.*switch to light/i
    );
    expect(document.documentElement).toHaveClass('light');
    expect(control).toHaveFocus();
  });

  it('restores the chosen preference after returning to the app', () => {
    const view = renderColorModeControl();
    const control = screen.getByRole('button', { name: /color mode/i });
    fireEvent.click(control);
    fireEvent.click(control);
    expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
    view.unmount();

    renderColorModeControl();
    expect(
      screen.getByRole('button', {
        name: /color mode: dark.*switch to system/i,
      })
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('tracks the OS only while System is selected', () => {
    const mediaQuery = installMatchMedia(false);
    renderColorModeControl();
    const control = screen.getByRole('button', { name: /color mode/i });

    fireEvent.click(control);
    act(() => mediaQuery.dispatch(true));
    expect(document.documentElement).toHaveClass('light');

    fireEvent.click(control);
    act(() => mediaQuery.dispatch(false));
    expect(document.documentElement).toHaveClass('dark');

    fireEvent.click(control);
    expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('system');
    expect(document.documentElement).toHaveClass('light');
    act(() => mediaQuery.dispatch(true));
    expect(document.documentElement).toHaveClass('dark');
    act(() => mediaQuery.dispatch(false));
    expect(document.documentElement).toHaveClass('light');
  });

  it('hydrates a saved preference without replacing server markup or resetting it', async () => {
    const app = (
      <ColorModeProvider>
        <ColorModeControl />
      </ColorModeProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(app);
    document.body.append(container);
    expect(container.querySelector('button')).toBeDisabled();
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'dark');
    const hydrationError = vi.fn();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, app, {
          onRecoverableError: hydrationError,
        });
      });
      expect(hydrationError).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', {
          name: /color mode: dark.*switch to system/i,
        })
      ).toBeEnabled();
      expect(document.documentElement).toHaveClass('dark');
      expect(localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
    } finally {
      await act(async () => root?.unmount());
      container.remove();
      consoleError.mockRestore();
    }
  });
});
