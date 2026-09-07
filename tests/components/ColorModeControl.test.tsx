// @vitest-environment happy-dom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ColorModeControl } from '@/components/ColorModeControl';
import { ColorModeProvider } from '@/lib/colorMode';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

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

  it('applies explicit light and dark choices immediately', () => {
    renderColorModeControl();

    const dark = screen.getByRole('radio', { name: /dark/i });
    fireEvent.click(dark);
    expect(dark).toBeChecked();
    expect(document.documentElement).toHaveClass('dark');

    const light = screen.getByRole('radio', { name: /light/i });
    fireEvent.click(light);
    expect(light).toBeChecked();
    expect(document.documentElement).toHaveClass('light');
  });

  it('keeps system mode synchronized with the operating-system preference', async () => {
    const mediaQuery = installMatchMedia(false);
    renderColorModeControl();
    fireEvent.click(screen.getByRole('radio', { name: /light/i }));

    fireEvent.click(screen.getByRole('radio', { name: /system/i }));

    await act(async () => {
      mediaQuery.dispatch(true);
    });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });
  });
});
