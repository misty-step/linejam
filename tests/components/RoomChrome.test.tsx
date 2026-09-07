// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

  it('keeps the invite, help, archive and color mode reachable', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    expect(
      screen.getByRole('button', { name: /Share room invite/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /More options/i }));
    const archiveLink = screen.getByRole('link', { name: /Your poems/i });
    expect(archiveLink).toHaveAttribute('href', '/me/poems');
    expect(
      screen.getByRole('dialog', { name: 'Room options' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Color mode' })
    ).toBeInTheDocument();
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
      expect(screen.getByRole('status')).toHaveTextContent(
        /invite link copied/i
      );
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
    const invite = screen.getByRole('dialog', { name: 'Invite friends' });
    fireEvent.click(
      within(invite).getByRole('button', { name: /copy room code/i })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn.t copy the room code/i
    );

    mockWriteText.mockResolvedValueOnce(undefined);
    fireEvent.click(
      screen.getByRole('button', { name: /retry copying room code/i })
    );
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenLastCalledWith('ABCD');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
    expect(screen.getByRole('status')).toHaveTextContent(/invite shared/i);
    expect(trackRoomInviteSharedSpy).toHaveBeenCalledWith({
      method: 'native-share',
      roomCode: 'ABCD',
    });
  });

  it('opens help from the toolbar and restores the triggering focus', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    const help = screen.getByRole('button', { name: /How to play/i });
    await user.click(help);
    expect(
      screen.getByRole('dialog', { name: /How to play/i })
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: /How to play/i })
    ).not.toBeInTheDocument();
    expect(help).toHaveFocus();
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

  it('closes room options on a backdrop click and restores focus', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    const trigger = screen.getByRole('button', { name: /More options/i });
    await user.click(trigger);
    expect(
      screen.getByRole('group', { name: /Color mode/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('presentation'));

    expect(
      screen.queryByRole('dialog', { name: 'Room options' })
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps keyboard focus inside options when using the native mode radios', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    const trigger = screen.getByRole('button', { name: /More options/i });
    await user.click(trigger);
    const dark = screen.getByRole('radio', { name: 'Dark' });
    await user.click(dark);
    expect(dark).toBeChecked();
    expect(document.documentElement).toHaveClass('dark');

    await user.tab();
    const close = screen.getByRole('button', { name: 'Close options' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(dark).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: 'Room options' })
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('returns from an invite opened through options to the original trigger', async () => {
    const user = userEvent.setup();
    renderWithColorMode(
      <RoomChrome roomCode="ABCD" title="Writing" subtitle="" compact />
    );

    const trigger = screen.getByRole('button', { name: /More options/i });
    await user.click(trigger);
    const options = screen.getByRole('dialog', { name: 'Room options' });
    await user.click(
      within(options).getByRole('button', { name: 'Invite friends' })
    );

    const invite = screen.getByRole('dialog', { name: 'Invite friends' });
    expect(
      within(invite).getByRole('img', {
        name: 'QR code for joining room AB CD',
      })
    ).toBeInTheDocument();
    expect(
      within(invite).getByRole('link', { name: 'Open join link' })
    ).toHaveAttribute('href', 'https://example.com/join?code=ABCD');
    await user.click(
      within(invite).getByRole('button', { name: 'Close invite' })
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
