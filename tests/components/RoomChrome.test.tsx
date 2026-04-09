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
        statusLabel="Lobby"
        title="Need 1 more player"
        subtitle="Share the code to start."
      />
    );
  }

  it('renders room controls', () => {
    renderRoomChrome();

    expect(
      screen.getByRole('button', { name: /Share room invite/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /View your poem archive/i })
    ).toHaveAttribute('href', '/me/poems');
    expect(
      screen.getByRole('button', { name: /How to play/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Choose theme/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Room AB CD')).toBeInTheDocument();
    expect(screen.getByText('Need 1 more player')).toBeInTheDocument();
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

  it('opens help and theme surfaces', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    await user.click(screen.getByRole('button', { name: /How to play/i }));
    expect(screen.getByText('Help modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Choose theme/i }));
    expect(screen.getByText('Theme chooser')).toBeInTheDocument();
  });

  it('closes the theme chooser on outside click and escape', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    await user.click(screen.getByRole('button', { name: /Choose theme/i }));
    expect(screen.getByText('Theme chooser')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText('Theme chooser')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Choose theme/i }));
    expect(screen.getByText('Theme chooser')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Theme chooser')).not.toBeInTheDocument();
    });
  });

  it('closes the theme chooser when the selector requests it', async () => {
    const user = userEvent.setup();
    renderRoomChrome();

    await user.click(screen.getByRole('button', { name: /Choose theme/i }));
    expect(screen.getByText('Theme chooser')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Close theme chooser/i })
    );

    await waitFor(() => {
      expect(screen.queryByText('Theme chooser')).not.toBeInTheDocument();
    });
  });
});
