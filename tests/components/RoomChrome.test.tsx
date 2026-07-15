// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => {
    const prefetchProps =
      prefetch === undefined ? {} : { 'data-prefetch': String(prefetch) };

    return (
      <a href={href} {...prefetchProps} {...props}>
        {children}
      </a>
    );
  },
}));

const mockTrackRoomInviteShared = vi.fn();

vi.mock('@/lib/analytics', () => ({
  trackRoomInviteShared: (props: unknown) => mockTrackRoomInviteShared(props),
}));

vi.mock('@/components/HelpModal', () => ({
  HelpModal: ({ isOpen }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div>Help modal</div> : null,
}));

vi.mock('@/components/ThemeSelector', () => ({
  ThemeSelector: ({ onClose }: { onClose: () => void }) => (
    <div>
      <div>Theme chooser</div>
      <button type="button" onClick={onClose}>
        Close theme chooser
      </button>
    </div>
  ),
}));

import { RoomChrome } from '@/components/RoomChrome';

describe('RoomChrome component', () => {
  let originalClipboard: Clipboard;
  let originalLocation: Location;
  let originalShare: Navigator['share'];
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    originalClipboard = navigator.clipboard;
    originalLocation = window.location;
    originalShare = navigator.share;

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: originalShare,
      configurable: true,
    });
  });

  function renderRoomChrome() {
    render(
      <RoomChrome
        roomCode="ABCD"
        title="Need 1 more player"
        subtitle="Share the code to start."
      />
    );
  }

  it('renders room controls', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    expect(
      screen.getByRole('button', { name: /Share room invite/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Room AB CD')).toBeInTheDocument();
    expect(screen.getByText('Need 1 more player')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Share room invite/i })
    ).toHaveClass('min-w-0', 'flex-1');
    expect(screen.getByText('Share the code to start.')).toHaveClass(
      'truncate',
      'text-xs',
      'md:text-sm'
    );

    // Archive / Help / Theme are tucked into the overflow menu.
    await user.click(screen.getByRole('button', { name: /More options/i }));
    const archiveLink = screen.getByRole('link', { name: /Your poems/i });
    expect(archiveLink).toHaveAttribute('href', '/me/poems');
    expect(archiveLink).toHaveAttribute('data-prefetch', 'false');
    // There are two "How to play" buttons: the direct chrome button and the overflow menu item.
    // Both are present when the menu is open.
    expect(
      screen.getAllByRole('button', { name: /How to play/i }).length
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole('button', { name: /^Theme$/i })
    ).toBeInTheDocument();
  });

  it('collapses active-game controls into one bounded toolbar', () => {
    render(
      <RoomChrome
        roomCode="ABCD"
        title="Round 1 · 1 word"
        subtitle=""
        compact
      />
    );

    expect(screen.getByTestId('room-chrome')).toHaveClass(
      'grid-cols-[minmax(0,1fr)_auto]',
      'items-center',
      'gap-[8px]',
      'px-[12px]',
      'py-[8px]'
    );
    expect(
      screen.getByRole('button', { name: /Share room invite/i })
    ).toHaveClass('h-[44px]', 'w-[44px]', 'flex-none', 'p-0');
    expect(screen.getByText('Invite')).toHaveClass('sr-only');
    expect(screen.getByRole('button', { name: /More options/i })).toHaveClass(
      'h-[44px]',
      'w-[44px]'
    );
  });

  it('copies a join link when native share is unavailable', async () => {
    renderRoomChrome();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Share room invite/i })
      );
    });

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        'https://example.com/join?code=ABCD'
      );
      expect(screen.getByText('Copied!')).toBeInTheDocument();
      expect(mockTrackRoomInviteShared).toHaveBeenCalledWith({
        method: 'clipboard',
        roomCode: 'ABCD',
      });
    });
  });

  it('uses native share when available', async () => {
    const nativeShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: nativeShare,
      writable: true,
      configurable: true,
    });
    renderRoomChrome();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Share room invite/i })
      );
    });

    expect(nativeShare).toHaveBeenCalledWith({
      title: 'Join my Linejam room',
      text: 'Join my Linejam room with code ABCD.',
      url: 'https://example.com/join?code=ABCD',
    });
    expect(screen.getByText('Shared!')).toBeInTheDocument();
    expect(mockTrackRoomInviteShared).toHaveBeenCalledWith({
      method: 'native-share',
      roomCode: 'ABCD',
    });
  });

  it('opens help and theme surfaces from the overflow menu', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    await user.click(screen.getByRole('button', { name: /More options/i }));
    // There are two "How to play" buttons — the second is in the overflow menu.
    const howToPlayBtns = screen.getAllByRole('button', {
      name: /How to play/i,
    });
    await user.click(howToPlayBtns[1]);
    expect(screen.getByText('Help modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /More options/i }));
    await user.click(screen.getByRole('button', { name: /^Theme$/i }));
    const themeChooser = screen.getByText('Theme chooser');
    expect(themeChooser).toBeInTheDocument();
    expect(themeChooser.closest('.lj-room-popover')).toBeInTheDocument();
  });

  it('tracks aria-expanded and returns focus to the trigger on escape', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    const trigger = screen.getByRole('button', { name: /More options/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('link', { name: /Your poems/i })
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(
        screen.queryByRole('link', { name: /Your poems/i })
      ).not.toBeInTheDocument();
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Keyboard focus is restored to the trigger, not dropped to <body>.
    expect(trigger).toHaveFocus();
  });

  it('closes the theme chooser on outside click and escape', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    const openTheme = async () => {
      await user.click(screen.getByRole('button', { name: /More options/i }));
      await user.click(screen.getByRole('button', { name: /^Theme$/i }));
    };

    await openTheme();
    expect(screen.getByText('Theme chooser')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText('Theme chooser')).not.toBeInTheDocument();
    });

    await openTheme();
    expect(screen.getByText('Theme chooser')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Theme chooser')).not.toBeInTheDocument();
    });
  });

  it('closes the theme chooser when the selector requests it', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    await user.click(screen.getByRole('button', { name: /More options/i }));
    await user.click(screen.getByRole('button', { name: /^Theme$/i }));
    expect(screen.getByText('Theme chooser')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Close theme chooser/i })
    );

    await waitFor(() => {
      expect(screen.queryByText('Theme chooser')).not.toBeInTheDocument();
    });
  });
});
