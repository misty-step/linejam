// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomChrome, type RoomAction } from '@/components/RoomChrome';
import { RoomInvite } from '@/components/RoomInvite';
import { ColorModeProvider } from '@/lib/colorMode';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

const originalClipboard = navigator.clipboard;
const originalShare = navigator.share;
const writeText = vi.fn<Clipboard['writeText']>();
let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  localStorage.clear();
  installMatchMedia(false);
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: originalClipboard,
    configurable: true,
  });
  Object.defineProperty(navigator, 'share', {
    value: originalShare,
    configurable: true,
  });
});

function renderChrome(action?: RoomAction, isLobby = false) {
  return render(
    <ColorModeProvider>
      <RoomChrome roomCode="ABCD" isLobby={isLobby} action={action} />
      {isLobby && <RoomInvite roomCode="ABCD" />}
    </ColorModeProvider>
  );
}

describe('room invitations', () => {
  it('offers one lobby invitation without another code or share entry in options', async () => {
    renderChrome(undefined, true);
    expect(
      screen.getAllByRole('region', { name: 'Room invitation' })
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: /copy room code/i })
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Share invite' })
    ).toHaveLength(1);
    expect(
      screen.getByRole('img', { name: /QR code for joining room/ })
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Room options' }));
    const options = screen.getByRole('dialog', { name: 'Room options' });
    expect(
      within(options).queryByRole('button', { name: /invite/i })
    ).toBeNull();
  });

  it('copies a usable join link when native share is unavailable', async () => {
    render(<RoomInvite roomCode="ABCD" />);
    await user.click(screen.getByRole('button', { name: 'Share invite' }));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/join?code=ABCD`
    );
    expect(screen.getByRole('status')).toHaveTextContent(/invite link copied/i);
  });

  it('recovers from denied code copying without losing the QR or invitation', async () => {
    writeText.mockRejectedValueOnce(new Error('clipboard blocked'));
    render(<RoomInvite roomCode="ABCD" />);
    await user.click(screen.getByRole('button', { name: /copy room code/i }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('img', { name: /QR code/ })).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: /retry copying room code/i })
    );
    expect(writeText).toHaveBeenLastCalledWith('ABCD');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(/room code copied/i);
  });

  it('uses native sharing without also copying the invite', async () => {
    const sharedUrls: string[] = [];
    Object.defineProperty(navigator, 'share', {
      value: async (data: ShareData) => {
        sharedUrls.push(data.url ?? '');
      },
      configurable: true,
    });
    render(<RoomInvite roomCode="ABCD" />);
    await user.click(screen.getByRole('button', { name: 'Share invite' }));
    expect(sharedUrls).toEqual([`${window.location.origin}/join?code=ABCD`]);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/invite shared/i);
  });

  it('opens the same invitation from play and restores keyboard focus on dismissal', async () => {
    renderChrome();
    const inviteTrigger = screen.getByRole('button', {
      name: /invite friends to room/i,
    });
    await user.click(inviteTrigger);
    const dialog = screen.getByRole('dialog', { name: 'Invite friends' });
    expect(
      within(dialog).getByRole('region', { name: 'Room invitation' })
    ).toBeVisible();
    const close = within(dialog).getByRole('button', { name: 'Close panel' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(
      within(dialog).getByRole('button', { name: 'Share invite' })
    ).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(inviteTrigger).toHaveFocus();
  });
});

describe('room options', () => {
  it('keeps help reachable without a second toolbar button or focus trap', async () => {
    renderChrome();
    expect(screen.queryByRole('button', { name: 'How to play' })).toBeNull();
    const options = screen.getByRole('button', { name: 'Room options' });
    await user.click(options);
    await user.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(options).toHaveFocus();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('requires confirmation and lets the host cancel ending a game', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    renderChrome({ kind: 'end-game', run });
    expect(screen.queryByRole('button', { name: 'End game' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Room options' }));
    await user.click(screen.getByRole('button', { name: 'End game' }));
    expect(
      screen.getByRole('dialog', { name: 'End this game?' })
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Room options' })).toBeVisible();
  });

  it('keeps a rejected end-game action retryable and prevents duplicate pending requests', async () => {
    const pending = Promise.withResolvers<void>();
    const run = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(undefined);
    renderChrome({ kind: 'end-game', run });
    await user.click(screen.getByRole('button', { name: 'Room options' }));
    await user.click(screen.getByRole('button', { name: 'End game' }));
    const confirm = screen.getByRole('button', { name: 'End game' });
    await user.dblClick(confirm);
    expect(run).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('dialog', { name: 'End this game?' })
    ).toBeVisible();
    await act(async () => pending.reject(new Error('request unavailable')));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: 'End game' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'End game' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does not expose a destructive action without a permitted operation', async () => {
    renderChrome();
    await user.click(screen.getByRole('button', { name: 'Room options' }));
    const options = screen.getByRole('dialog', { name: 'Room options' });
    expect(
      within(options).queryByRole('button', {
        name: /end game|close room|leave room/i,
      })
    ).toBeNull();
    expect(
      within(options).getByRole('link', { name: 'Your poems' })
    ).toHaveAttribute('href', '/me/poems');
    fireEvent.click(screen.getByRole('presentation'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
