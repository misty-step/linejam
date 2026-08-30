// @vitest-environment happy-dom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

  it('renders one native, named radio set without tab roles', () => {
    renderColorModeControl();

    const group = screen.getByRole('group', { name: /color mode/i });
    const radios = within(group).getAllByRole('radio');

    expect(radios).toHaveLength(3);
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
      'light',
      'dark',
      'system',
    ]);
    expect(
      radios.every((radio) => radio.getAttribute('name') === 'color-mode')
    ).toBe(true);
    for (const radio of radios) {
      expect(radio.closest('label')).toHaveClass('min-h-11');
    }
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
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

    fireEvent.click(screen.getByRole('radio', { name: /system/i }));

    await act(async () => {
      mediaQuery.dispatch(true);
    });

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });
  });

  it('leaves arrow keys to the browser-native radio implementation', () => {
    renderColorModeControl();

    const dark = screen.getByRole('radio', { name: /dark/i });
    dark.focus();
    const arrow = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    dark.dispatchEvent(arrow);

    expect(arrow.defaultPrevented).toBe(false);
    expect(dark).toHaveFocus();
  });
});
