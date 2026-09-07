// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { ConvexError } from 'convex/values';
import {
  JoinPage,
  type JoinPageDependencies,
  type JoinRoom,
  type JoinRoomResult,
} from '@/app/join/JoinPage';
import { ColorModeProvider } from '@/lib/colorMode';
import { setErrorReporterForTests } from '@/lib/error';
import { sanitizeSentryReporterContext } from '@/lib/sentryPrivacy';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

const joinRoom = vi.fn<JoinRoom>();
const push = vi.fn();
const retryAuth = vi.fn();
let guestToken: string | null = 'guest-token';
let isLoading = false;
let authError: string | null = null;

const dependencies: JoinPageDependencies = {
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
  useUser: () => ({ guestToken, isLoading, authError, retryAuth }),
  useJoinRoom: () => joinRoom,
};

function renderJoinPage() {
  return render(<JoinPage dependencies={dependencies} />, {
    wrapper: ColorModeProvider,
  });
}

async function enterDetails(
  user: UserEvent,
  roomCode: string,
  penName: string
) {
  const code = screen.getByRole('textbox', { name: /room code/i });
  const name = screen.getByRole('textbox', { name: /your pen name/i });
  await user.type(code, roomCode);
  await user.type(name, penName);
  return { code, name };
}

describe('joining a room', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    installMatchMedia(false);
    guestToken = 'guest-token';
    isLoading = false;
    authError = null;
    joinRoom.mockResolvedValue({ _id: 'room-1' });
    setErrorReporterForTests({
      captureException: vi.fn(),
      isEnabled: () => true,
      sanitizeContext: sanitizeSentryReporterContext,
    });
  });

  afterEach(() => {
    setErrorReporterForTests(null);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
    localStorage.clear();
  });

  it('normalizes manual entry and joins with the trimmed pen name and chosen avatar', async () => {
    const user = userEvent.setup();
    renderJoinPage();
    const { code } = await enterDetails(
      user,
      'a-1b cDextra',
      '  Ada Lovelace  '
    );
    expect(code).toHaveValue('ABCD');

    const pip = screen.getByRole('radio', { name: 'Pip' });
    const orbit = screen.getByRole('radio', { name: 'Orbit' });
    await user.click(pip);
    expect(pip).toBeChecked();
    await user.click(orbit);
    expect(orbit).toBeChecked();
    expect(pip).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: /^join room$/i }));

    expect(joinRoom).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      displayName: 'Ada Lovelace',
      avatarId: 'orbit',
      guestToken: 'guest-token',
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledExactlyOnceWith('/room/ABCD')
    );
  });

  it('requires a room code and a nonblank pen name before allowing a join', async () => {
    const user = userEvent.setup();
    renderJoinPage();
    const { code, name } = await enterDetails(user, '123-!', 'Ada');
    const submit = screen.getByRole('button', { name: /^join room$/i });

    expect(code).toHaveValue('');
    expect(submit).toBeDisabled();
    await user.click(submit);
    await user.click(name);
    await user.keyboard('{Enter}');
    expect(joinRoom).not.toHaveBeenCalled();

    await user.type(code, 'ABCD');
    await user.clear(name);
    await user.type(name, '   ');
    expect(submit).toBeDisabled();
    await user.click(submit);
    await user.click(name);
    await user.keyboard('{Enter}');
    expect(joinRoom).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();

    await user.clear(name);
    await user.type(name, 'Ada');
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() =>
      expect(push).toHaveBeenCalledExactlyOnceWith('/room/ABCD')
    );
  });

  it.each([
    {
      rejection: 'a full room',
      cause: new ConvexError('Room is full'),
      reason: /full/i,
      recovery: /host.*new room/i,
    },
    {
      rejection: 'a closed room',
      cause: new ConvexError('Room is closed'),
      reason: /closed/i,
      recovery: /host.*new room code/i,
    },
    {
      rejection: 'a game that no longer accepts players',
      cause: new ConvexError('Cannot join this game state'),
      reason: /already started/i,
      recovery: /next session|host.*new room/i,
    },
    {
      rejection: 'an unexpected service failure',
      cause: new Error('Private database failure: write transaction 317'),
      reason: /try again/i,
      recovery: /refresh/i,
    },
  ])(
    'offers a usable recovery from $rejection',
    async ({ cause, reason, recovery }) => {
      joinRoom.mockRejectedValueOnce(cause);
      const user = userEvent.setup();
      renderJoinPage();
      const { code, name } = await enterDetails(user, 'ABCD', 'Ada');
      const sunny = screen.getByRole('radio', { name: 'Sunny' });
      await user.click(sunny);
      await user.click(screen.getByRole('button', { name: /^join room$/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(reason);
      expect(alert).toHaveTextContent(recovery);
      expect(alert).not.toHaveTextContent(/private database|transaction 317/i);
      expect(push).not.toHaveBeenCalled();
      expect(code).toBeEnabled();
      expect(code).toHaveValue('ABCD');
      expect(name).toBeEnabled();
      expect(name).toHaveValue('Ada');
      expect(sunny).toBeEnabled();
      expect(sunny).toBeChecked();

      await user.clear(code);
      await user.type(code, 'wxyz');
      await user.clear(name);
      await user.type(name, 'Grace');
      const retry = screen.getByRole('button', { name: /^join room$/i });
      expect(retry).toBeEnabled();
      await user.click(retry);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(joinRoom).toHaveBeenCalledTimes(2);
      expect(joinRoom).toHaveBeenLastCalledWith({
        code: 'WXYZ',
        displayName: 'Grace',
        avatarId: 'sunny',
        guestToken: 'guest-token',
      });
      await waitFor(() =>
        expect(push).toHaveBeenCalledExactlyOnceWith('/room/WXYZ')
      );
    }
  );

  it('offers authentication retry and waits for a usable session before joining', async () => {
    guestToken = null;
    isLoading = true;
    authError = 'Unable to establish your guest session.';
    const user = userEvent.setup();
    const view = renderJoinPage();

    expect(screen.getByRole('alert')).toBeVisible();
    expect(
      screen.queryByRole('form', { name: /join room/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /try again/i });
    expect(retry).toBeEnabled();
    await user.click(retry);
    expect(retryAuth).toHaveBeenCalledTimes(1);
    expect(joinRoom).not.toHaveBeenCalled();

    authError = null;
    view.rerender(<JoinPage dependencies={dependencies} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(
      screen.queryByRole('form', { name: /join room/i })
    ).not.toBeInTheDocument();

    guestToken = 'renewed-guest-token';
    isLoading = false;
    view.rerender(<JoinPage dependencies={dependencies} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await enterDetails(user, 'ABCD', 'Ada');
    await user.click(screen.getByRole('radio', { name: 'Moss' }));
    await user.click(screen.getByRole('button', { name: /^join room$/i }));

    expect(joinRoom).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      displayName: 'Ada',
      avatarId: 'moss',
      guestToken: 'renewed-guest-token',
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledExactlyOnceWith('/room/ABCD')
    );
  });

  it('reports progress and prevents duplicate requests while a signed-in player joins', async () => {
    guestToken = null;
    const pending = Promise.withResolvers<JoinRoomResult>();
    joinRoom.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    renderJoinPage();
    const { code, name } = await enterDetails(user, 'ABCD', 'Ada');
    const plum = screen.getByRole('radio', { name: 'Plum' });
    await user.click(plum);
    await user.dblClick(screen.getByRole('button', { name: /^join room$/i }));

    const progress = screen.getByRole('button', { name: /joining room/i });
    expect(progress).toBeDisabled();
    expect(code).toBeDisabled();
    expect(name).toBeDisabled();
    expect(plum).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
    await user.click(progress);
    await user.keyboard('{Enter}');
    expect(joinRoom).toHaveBeenCalledExactlyOnceWith({
      code: 'ABCD',
      displayName: 'Ada',
      avatarId: 'plum',
      guestToken: undefined,
    });

    await act(async () => pending.resolve({ _id: 'room-2', currentCycle: 3 }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledExactlyOnceWith('/room/ABCD')
    );
    expect(joinRoom).toHaveBeenCalledTimes(1);
  });
});
