// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  JoinPage,
  type JoinPageDependencies,
  type JoinRoom,
} from '@/app/join/JoinPage';
import { Header } from '@/components/Header';
import type { HeaderDependencies } from '@/components/Header';
import { ColorModeProvider } from '@/lib/colorMode';
import { installMatchMedia } from '@/tests/helpers/matchMedia';
import { SignInPage } from '@/app/(auth)/sign-in/[[...sign-in]]/SignInPage';
import { SignUpPage } from '@/app/(auth)/sign-up/[[...sign-up]]/SignUpPage';
import { AccountContext } from '@/lib/account';

let currentPathname = '/join';
let currentSearchParams = new URLSearchParams('code=ABCD');
let currentIsSignedIn = false;

const mockRouter = { push: vi.fn() };
const mockJoinRoom = vi.fn<JoinRoom>();

const joinDependencies: JoinPageDependencies = {
  useRouter: () => mockRouter,
  useSearchParams: () => currentSearchParams,
  useUser: () => ({
    guestToken: 'guest-token',
    isLoading: false,
    authError: null,
    retryAuth: vi.fn(),
  }),
  useJoinRoom: () => mockJoinRoom,
};

const headerDependencies: HeaderDependencies = {
  usePathname: () => currentPathname,
  SignedOut: ({ children }) => (currentIsSignedIn ? null : <>{children}</>),
  SignedIn: ({ children }) => (currentIsSignedIn ? <>{children}</> : null),
  AccountButton: () => <button type="button">Account</button>,
};

function renderEntry(ui: ReactNode) {
  return render(<ColorModeProvider>{ui}</ColorModeProvider>);
}

describe('entry and shell behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.className = '';
    currentIsSignedIn = false;
    mockJoinRoom.mockResolvedValue({ _id: 'room-1' });
    currentPathname = '/join';
    currentSearchParams = new URLSearchParams('code=ABCD');
    installMatchMedia(false);
  });

  it('preserves invitation prefill and Enter-to-name navigation', async () => {
    renderEntry(<JoinPage dependencies={joinDependencies} />);

    const code = await screen.findByRole('textbox', { name: /room code/i });
    const name = screen.getByRole('textbox', { name: /your pen name/i });
    expect(code).toHaveValue('ABCD');
    expect(code).not.toHaveAttribute('readonly');
    expect(name).toBeRequired();

    fireEvent.keyDown(code, { key: 'Enter' });
    expect(name).toHaveFocus();
  });

  it('keeps account, archive, help, and appearance paths available without duplicate controls', () => {
    currentPathname = '/me/poems';
    renderEntry(<Header dependencies={headerDependencies} />);

    expect(screen.getByRole('link', { name: 'Linejam' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in'
    );
    expect(screen.getAllByRole('button', { name: 'Appearance' })).toHaveLength(
      1
    );

    const menu = screen.getByRole('button', { name: 'More options' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Your poems' })).toHaveAttribute(
      'href',
      '/me/poems'
    );
    expect(
      screen.getByRole('button', { name: 'How to play' })
    ).toBeInTheDocument();

    const appearance = screen.getByRole('button', { name: 'Appearance' });
    fireEvent.click(appearance);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('group', { name: 'Color mode' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(appearance).toHaveFocus();
    expect(
      screen.queryByRole('group', { name: 'Color mode' })
    ).not.toBeInTheDocument();
  });

  it('renders the signed-in account control', () => {
    currentPathname = '/me/poems';
    currentIsSignedIn = true;

    renderEntry(<Header dependencies={headerDependencies} />);

    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Sign in' })
    ).not.toBeInTheDocument();
  });

  it('closes the header menu outside or with Escape and restores focus', () => {
    currentPathname = '/me/poems';
    renderEntry(<Header dependencies={headerDependencies} />);

    const menu = screen.getByRole('button', { name: 'More options' });
    fireEvent.click(menu);
    expect(screen.getByRole('link', { name: 'Your poems' })).toHaveFocus();
    fireEvent.pointerDown(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();

    fireEvent.click(menu);
    fireEvent.pointerDown(document.body);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('defers to focused account and gameplay chrome', () => {
    currentPathname = '/sign-in';
    const { rerender } = renderEntry(
      <Header dependencies={headerDependencies} />
    );
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();

    currentPathname = '/join';
    rerender(
      <ColorModeProvider>
        <Header dependencies={headerDependencies} />
      </ColorModeProvider>
    );
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();

    currentPathname = '/room/ABCD';
    rerender(
      <ColorModeProvider>
        <Header dependencies={headerDependencies} />
      </ColorModeProvider>
    );
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it.each([SignInPage, SignUpPage])(
    'offers guest play on a disconnected local account route',
    (AccountPage) => {
      render(
        <AccountContext.Provider value={{ kind: 'local' }}>
          <AccountPage />
        </AccountContext.Provider>
      );
      expect(
        screen.getByRole('link', { name: /play as guest/i })
      ).toHaveAttribute('href', '/');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    }
  );
});
