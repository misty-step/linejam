// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemesPage from '@/app/themes/page';
import { ThemeProvider } from '@/lib/themes';
import { visibleThemeIds, themes, defaultThemeId } from '@/lib/themes/registry';

function renderPage() {
  return render(
    <ThemeProvider>
      <ThemesPage />
    </ThemeProvider>
  );
}

describe('/themes specimen page', () => {
  it('renders one specimen card per visible theme, none for retired ones', () => {
    renderPage();
    const group = screen.getByRole('radiogroup', { name: /select theme/i });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(visibleThemeIds.length);
    expect(screen.queryByTestId('theme-specimen-mono')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('theme-specimen-vintage-paper')
    ).not.toBeInTheDocument();
  });

  it('marks the active theme and names it in the header', () => {
    renderPage();
    const active = screen.getByTestId(`theme-specimen-${defaultThemeId}`);
    expect(active).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByText(themes[defaultThemeId].label, { selector: 'strong' })
    ).toBeInTheDocument();
  });

  it('selecting a specimen applies the theme immediately', async () => {
    const user = userEvent.setup();
    renderPage();
    const target = visibleThemeIds.find((id) => id !== defaultThemeId)!;
    await user.click(screen.getByTestId(`theme-specimen-${target}`));
    expect(screen.getByTestId(`theme-specimen-${target}`)).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe(target);
  });

  it('every card previews the same canonical specimen line', () => {
    renderPage();
    expect(screen.getAllByText('moonlight over quiet stones')).toHaveLength(
      visibleThemeIds.length
    );
  });
});
