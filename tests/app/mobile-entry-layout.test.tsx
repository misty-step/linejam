// @vitest-environment happy-dom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const mockUseSearchParams = vi.fn();
const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useQuery: () => undefined,
}));

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: ReactNode }) => children,
  UserButton: () => <button type="button">Account</button>,
  useUser: () => ({ user: null, isLoaded: true }),
  SignIn: () => (
    <div>
      <p>Don&apos;t have an account? Sign up</p>
    </div>
  ),
  SignUp: () => (
    <div>
      <p>Already have an account? Sign in</p>
    </div>
  ),
}));

import AuthLayout from '@/app/(auth)/layout';
import JoinPage from '@/app/join/page';
import { Header } from '@/components/Header';

describe('mobile entry layout', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/join');
    mockUseSearchParams.mockReturnValue(new URLSearchParams('code=ABCD'));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ guestId: 'guest-123', token: 'guest-token' }),
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('keeps the join action inline with the required fields on narrow phones', async () => {
    render(<JoinPage />);

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
    render(
      <AuthLayout>
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
    render(<Header />);

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

  it('closes the mobile header menu outside or with Escape and restores focus', () => {
    render(<Header />);

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
    mockUsePathname.mockReturnValue('/sign-in');
    const { rerender } = render(<Header />);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();

    mockUsePathname.mockReturnValue('/room/ABCD');
    rerender(<Header />);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('renders exactly one account-switch prompt on sign-in', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_mobile_entry');
    vi.resetModules();
    const { default: SignInPage } =
      await import('@/app/(auth)/sign-in/[[...sign-in]]/page');

    render(<SignInPage />);

    expect(screen.getAllByText(/don(?:'|’)t have an account/i)).toHaveLength(1);
  });

  it('renders exactly one account-switch prompt on sign-up', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_mobile_entry');
    vi.resetModules();
    const { default: SignUpPage } =
      await import('@/app/(auth)/sign-up/[[...sign-up]]/page');

    render(<SignUpPage />);

    expect(screen.getAllByText(/already have an account/i)).toHaveLength(1);
  });
});
