// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomChrome } from '@/components/RoomChrome';
import * as analyticsModule from '@/lib/analytics';
import { ColorModeProvider } from '@/lib/colorMode';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

describe('RoomChrome component', () => {
  let originalClipboard: Clipboard;
  let originalLocation: Location;
  let originalShare: Navigator['share'];
  const mockWriteText = vi.fn().mockResolvedValue(undefined);
  let trackRoomInviteSharedSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.className = '';
    installMatchMedia(false);
    originalClipboard = navigator.clipboard;
    originalLocation = window.location;
    originalShare = navigator.share;

    trackRoomInviteSharedSpy = vi
      .spyOn(analyticsModule, 'trackRoomInviteShared')
      .mockImplementation(() => {});

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
    trackRoomInviteSharedSpy.mockRestore();
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

  function renderWithColorMode(ui: React.ReactElement) {
    return render(<ColorModeProvider>{ui}</ColorModeProvider>);
  }

  function renderRoomChrome() {
    renderWithColorMode(
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
      'whitespace-normal',
      'break-words',
      'text-xs',
      'md:text-sm'
    );
    expect(screen.getByText('Share the code to start.')).not.toHaveClass(
      'truncate'
    );

    // Archive / Help / Appearance are tucked into the overflow menu.
    await user.click(screen.getByRole('button', { name: /More options/i }));
    const archiveLink = screen.getByRole('link', { name: /Your poems/i });
    expect(archiveLink).toHaveAttribute('href', '/me/poems');
    // There are two "How to play" buttons: the direct chrome button and the overflow menu item.
    expect(
      screen.getAllByRole('button', { name: /How to play/i }).length
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole('button', { name: /^Appearance$/i })
    ).toBeInTheDocument();
  });

  it('does not emphasize Invite when post-reveal actions own the hierarchy', () => {
    renderWithColorMode(
      <RoomChrome
        roomCode="ABCD"
        title="All poems revealed"
        subtitle="Start another round, or leave the room."
        inviteEmphasized={false}
      />
    );

    expect(
      screen.getByRole('button', { name: /Share room invite/i })
    ).not.toHaveClass('bg-primary');
    expect(
      screen.getByText('Start another round, or leave the room.')
    ).toBeInTheDocument();
  });

  it('collapses active-game controls into one bounded toolbar', () => {
    renderWithColorMode(
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

  it('renders the status-board ticker as one glanceable active-room status', () => {
    renderWithColorMode(
      <RoomChrome
        roomCode="ABCD"
        title="Round 1 · 1 word"
        subtitle=""
        statusBoard
      />
    );

    expect(screen.getByTestId('room-chrome')).toHaveAttribute(
      'data-layout',
      'status-board'
    );
    expect(screen.getByTestId('room-chrome')).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-[minmax(0,1fr)_auto]'
    );
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 · 1 word');
    for (const label of [
      /Share room invite/i,
      /How to play/i,
      /More options/i,
    ]) {
      expect(screen.getByRole('button', { name: label })).toHaveClass(
        'h-[44px]',
        'w-[44px]'
      );
    }
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
      expect(trackRoomInviteSharedSpy).toHaveBeenCalledWith({
        method: 'clipboard',
        roomCode: 'ABCD',
      });
    });
  });

  it('surfaces room-code clipboard failures and recovers on retry', async () => {
    mockWriteText.mockRejectedValueOnce(new Error('clipboard blocked'));
    renderRoomChrome();

    fireEvent.click(screen.getByRole('button', { name: /Room code AB CD/i }));
    fireEvent.click(screen.getByRole('button', { name: /copy room code/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn.t copy the room code/i
    );

    mockWriteText.mockResolvedValueOnce(undefined);
    fireEvent.click(
      screen.getByRole('button', { name: /retry copying room code/i })
    );
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
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
    expect(trackRoomInviteSharedSpy).toHaveBeenCalledWith({
      method: 'native-share',
      roomCode: 'ABCD',
    });
  });

  it('opens help and appearance surfaces from the overflow menu', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    await user.click(screen.getByRole('button', { name: /More options/i }));
    // There are two "How to play" buttons — the second is in the overflow menu.
    const howToPlayBtns = screen.getAllByRole('button', {
      name: /How to play/i,
    });
    await user.click(howToPlayBtns[1]);
    expect(
      screen.getByRole('heading', { name: /How to Play/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Got it/i }));

    await user.click(screen.getByRole('button', { name: /More options/i }));
    await user.click(screen.getByRole('button', { name: /^Appearance$/i }));
    const appearance = screen.getByRole('dialog', { name: /Appearance/i });
    expect(
      screen.getByRole('group', { name: /Color mode/i })
    ).toBeInTheDocument();
    expect(appearance).toHaveClass('lj-room-popover');

    await user.click(screen.getByRole('radio', { name: /Dark/i }));
    expect(screen.getByRole('radio', { name: /Dark/i })).toBeChecked();
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

  it('closes the appearance chooser on outside click and escape', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    const openAppearance = async () => {
      await user.click(screen.getByRole('button', { name: /More options/i }));
      await user.click(screen.getByRole('button', { name: /^Appearance$/i }));
    };

    await openAppearance();
    expect(
      screen.getByRole('group', { name: /Color mode/i })
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(
        screen.queryByRole('group', { name: /Color mode/i })
      ).not.toBeInTheDocument();
    });

    await openAppearance();
    expect(
      screen.getByRole('group', { name: /Color mode/i })
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(
        screen.queryByRole('group', { name: /Color mode/i })
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /More options/i })).toHaveFocus();
  });

  it('closes appearance when Escape starts inside the native radio group', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    await user.click(screen.getByRole('button', { name: /More options/i }));
    await user.click(screen.getByRole('button', { name: /^Appearance$/i }));
    const colorModes = screen.getByRole('group', {
      name: /Color mode/i,
    });

    fireEvent.keyDown(colorModes, { key: 'Escape' });

    await waitFor(() => {
      expect(
        screen.queryByRole('group', { name: /Color mode/i })
      ).not.toBeInTheDocument();
    });
  });
});
