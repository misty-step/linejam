// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  AuthLayout,
  type AuthLayoutDependencies,
} from '@/app/(auth)/AuthLayout';
import {
  JoinPage,
  type JoinPageDependencies,
  type JoinRoom,
} from '@/app/join/JoinPage';
import { Header } from '@/components/Header';
import type { HeaderDependencies } from '@/components/Header';
import {
  SignInPage,
  type SignInPageDependencies,
} from '@/app/(auth)/sign-in/[[...sign-in]]/SignInPage';
import {
  SignUpPage,
  type SignUpPageDependencies,
} from '@/app/(auth)/sign-up/[[...sign-up]]/SignUpPage';

let currentPathname = '/join';
let currentSearchParams = new URLSearchParams('code=ABCD');
let currentIsSignedIn = false;

const mockRouter = { push: vi.fn() };
const mockJoinRoom = vi.fn<JoinRoom>();
const authLayoutDependencies: AuthLayoutDependencies = {
  ShowcaseComponent: () => <div>Recent Creation</div>,
};

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

const signInDependencies: SignInPageDependencies = {
  isClerkConfigured: true,
  SignInComponent: () => <div>Don&apos;t have an account</div>,
};

const signUpDependencies: SignUpPageDependencies = {
  isClerkConfigured: true,
  SignUpComponent: () => <div>Already have an account</div>,
};

function renderEntry(ui: ReactNode) {
  return render(ui);
}

describe('mobile entry layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentIsSignedIn = false;
    mockJoinRoom.mockResolvedValue({ _id: 'room-1' });
    currentPathname = '/join';
    currentSearchParams = new URLSearchParams('code=ABCD');
  });

  it('keeps the join action inline with the required fields on narrow phones', async () => {
    renderEntry(<JoinPage dependencies={joinDependencies} />);

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: /join session/i,
    });
    const button = screen.getByRole('button', { name: /enter room/i });
    const actionRegion = button.parentElement;

    expect(heading).toHaveClass('text-3xl', 'sm:text-4xl');
    expect(actionRegion).not.toHaveClass('fixed');
    expect(actionRegion).not.toHaveClass('inset-x-0', 'bottom-0');
    const code = screen.getByLabelText(/room code/i);
    const name = screen.getByLabelText(/your name/i);
    expect(code).toBeInTheDocument();
    expect(name).toBeInTheDocument();

    fireEvent.keyDown(code, { key: 'Enter' });
    expect(name).toHaveFocus();
  });

  it('puts the account task before decorative poem content on phones', () => {
    renderEntry(
      <AuthLayout dependencies={authLayoutDependencies}>
        <div>Account access</div>
      </AuthLayout>
    );

    const authColumn =
      screen.getByText('Account access').parentElement?.parentElement;
    const showcaseColumn = screen
      .getByText('Recent Creation')
      .closest('.flex-1');

    expect(authColumn).not.toHaveClass('order-2');
    expect(showcaseColumn).toHaveClass('hidden', 'lg:block');
    expect(authColumn).toHaveClass('justify-start', 'lg:justify-center');
    expect(screen.getByRole('link', { name: 'Linejam' })).toHaveClass(
      'min-h-11'
    );
  });

  it('uses compact header spacing without shrinking visible touch targets', () => {
    renderEntry(<Header dependencies={headerDependencies} />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('px-3', 'gap-2', 'sm:px-6');
    expect(screen.getByRole('link', { name: 'Linejam' })).toHaveClass(
      'min-h-11'
    );

    for (const name of [
      'Sign in',
      'View your poem archive',
      'How to play',
      'Choose theme',
    ]) {
      expect(
        screen.getByRole(/play/.test(name) ? 'button' : 'link', { name })
      ).toHaveClass('w-11', 'h-11');
    }

    const menu = screen.getByRole('button', { name: 'More options' });
    expect(menu).toHaveClass('w-11', 'h-11');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Your poems' })).toHaveClass(
      'min-h-11'
    );
  });

  it('renders the signed-in account control through Show', () => {
    currentIsSignedIn = true;

    renderEntry(<Header dependencies={headerDependencies} />);

    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Sign in' })
    ).not.toBeInTheDocument();
  });

  it('closes the mobile header menu outside or with Escape and restores focus', () => {
    renderEntry(<Header dependencies={headerDependencies} />);

    const menu = screen.getByRole('button', { name: 'More options' });
    fireEvent.click(menu);
    fireEvent.mouseDown(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();

    fireEvent.click(menu);
    fireEvent.mouseDown(document.body);
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('defers to focused account and gameplay chrome', () => {
    currentPathname = '/sign-in';
    const { rerender } = renderEntry(
      <Header dependencies={headerDependencies} />
    );
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();

    currentPathname = '/room/ABCD';
    rerender(<Header dependencies={headerDependencies} />);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('renders exactly one account-switch prompt on sign-in', () => {
    renderEntry(<SignInPage dependencies={signInDependencies} />);

    expect(screen.getAllByText(/don(?:'|’)t have an account/i)).toHaveLength(1);
  });

  it('renders exactly one account-switch prompt on sign-up', () => {
    renderEntry(<SignUpPage dependencies={signUpDependencies} />);

    expect(screen.getAllByText(/already have an account/i)).toHaveLength(1);
  });
});
