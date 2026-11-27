'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../convex/_generated/api';
import { useUser } from '../lib/auth';
import { captureError } from '../lib/error';
import { errorToFeedback } from '../lib/errorFeedback';
import { toErrorReportable } from '../lib/errorCore';
import {
  hashRoomId,
  trackGameCreated,
  trackGameJoined,
  trackJoinAttempted,
  trackJoinFailed,
} from '../lib/analytics';
import { playSound } from '../lib/audio';
import { normalizeRoomCodeInput } from '../lib/roomCode';
import { AVATAR_IDS, getRandomAvatarId, type AvatarId } from '../lib/avatars';
import { E2E_TEST_IDS } from '../lib/e2eTestIds';
import { AuthErrorState } from './AuthErrorState';
import { EmblemPicker } from './EmblemPicker';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

type Pending = 'create' | 'join' | null;

/**
 * Landing salon spread (DESIGN.md [D1-4.4]): pen name and emblem on the left,
 * the action sheet with `New room`, `Room code` and `Join` on the right.
 */
export function Landing() {
  const router = useRouter();
  const { guestToken, isLoading, authError, retryAuth } = useUser();
  const createRoom = useMutation(api.rooms.createRoom);
  const joinRoom = useMutation(api.rooms.joinRoom);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [avatarId, setAvatarId] = useState<AvatarId>(AVATAR_IDS[0]);
  const initialAvatarRef = useRef<AvatarId | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [nameError, setNameError] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    initialAvatarRef.current ??= getRandomAvatarId();
    const initialAvatar = initialAvatarRef.current;
    let isStale = false;
    // Keep server and hydration markup identical; seed the random emblem once.
    queueMicrotask(() => {
      if (!isStale) setAvatarId(initialAvatar);
    });
    return () => {
      isStale = true;
    };
  }, []);

  const requireName = (): string | null => {
    const displayName = name.trim();
    if (displayName) return displayName;
    setNameError('Add a pen name');
    playSound('error');
    nameRef.current?.focus();
    return null;
  };

  const handleCreate = async () => {
    setCreateError('');
    setJoinError('');
    const displayName = requireName();
    if (!displayName) return;
    setPending('create');
    try {
      const { code: roomCode, roomId } = await createRoom({
        displayName,
        avatarId,
        guestToken: guestToken || undefined,
      });
      trackGameCreated({ roomIdHash: hashRoomId(roomId), cycle: 1 });
      playSound('sparkle');
      router.push(`/room/${roomCode}`);
    } catch (cause) {
      playSound('error');
      const error = toErrorReportable(cause);
      setCreateError(errorToFeedback(error).message);
      captureError(error, { displayName, guestToken });
      setPending(null);
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setJoinError('');
    const roomCode = normalizeRoomCodeInput(code);
    if (roomCode.length !== 4) {
      setJoinError('Use a 4-letter room code');
      playSound('error');
      codeRef.current?.focus();
      return;
    }
    const displayName = requireName();
    if (!displayName) return;
    setPending('join');
    trackJoinAttempted();
    try {
      const room = await joinRoom({
        code: roomCode,
        displayName,
        avatarId,
        guestToken: guestToken || undefined,
      });
      if (room.ok === false) {
        trackJoinFailed(room.code);
        playSound('error');
        setJoinError(
          errorToFeedback(toErrorReportable(new ConvexError(room.message)))
            .message
        );
        setPending(null);
        return;
      }
      trackGameJoined({
        roomIdHash: hashRoomId(room._id),
        cycle: room.currentCycle ?? 1,
      });
      playSound('sparkle');
      router.push(`/room/${roomCode}`);
    } catch (cause) {
      trackJoinFailed('REQUEST_FAILED');
      playSound('error');
      const error = toErrorReportable(cause);
      setJoinError(errorToFeedback(error).message);
      captureError(error, { roomCode });
      setPending(null);
    }
  };

  if (authError) {
    return <AuthErrorState message={authError} onRetry={retryAuth} />;
  }

  const busy = isLoading || pending !== null;

  return (
    <div className="flex flex-1 bg-[var(--bg)] md:bg-[var(--bg-desk)]">
      <section
        aria-labelledby="landing-title"
        className="mx-auto grid w-full max-w-[920px] content-start gap-6 px-4 py-6 md:my-auto md:grid-cols-2 md:gap-10 md:px-8 md:py-14"
      >
        <div className="min-w-0 space-y-6">
          <h1
            id="landing-title"
            className="font-serif text-[2.75rem] font-medium leading-none tracking-tight text-[var(--ink)] md:text-[3.5rem]"
          >
            Linejam
          </h1>
          <div className="space-y-1.5">
            <label
              htmlFor="pen-name"
              className="block text-sm font-semibold text-[var(--ink)]"
            >
              Pen name
            </label>
            <Input
              ref={nameRef}
              id="pen-name"
              name="displayName"
              data-testid={E2E_TEST_IDS.landingNameInput}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError('');
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'pen-name-error' : undefined}
              autoCapitalize="words"
              autoComplete="nickname"
              enterKeyHint="done"
              maxLength={40}
              disabled={pending !== null}
              className={nameError ? 'lj-nudge' : undefined}
            />
            {nameError && (
              <p
                id="pen-name-error"
                role="alert"
                className="text-sm font-semibold text-[var(--danger)]"
              >
                {nameError}
              </p>
            )}
          </div>
          <EmblemPicker
            value={avatarId}
            onChange={setAvatarId}
            disabled={pending !== null}
          />
        </div>

        <div className="min-w-0 self-start rounded-[var(--radius-sheet)] border border-[var(--hairline)] bg-[var(--surface)] p-4 md:p-6">
          <div className="space-y-2">
            <Button
              type="button"
              data-testid={E2E_TEST_IDS.landingNewRoomButton}
              data-sound="loading"
              className="w-full"
              disabled={busy}
              aria-busy={pending === 'create' ? true : undefined}
              onClick={() => void handleCreate()}
            >
              {pending === 'create' ? 'Opening room…' : 'New room'}
            </Button>
            {createError && (
              <p
                role="alert"
                className="text-sm font-semibold text-[var(--danger)]"
              >
                {createError}
              </p>
            )}
          </div>

          <hr className="my-5 border-0 border-t border-[var(--hairline)]" />

          <form
            onSubmit={handleJoin}
            aria-label="Join"
            noValidate
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="room-code"
                className="block text-sm font-semibold text-[var(--ink)]"
              >
                Room code
              </label>
              <Input
                ref={codeRef}
                id="room-code"
                name="roomCode"
                data-testid={E2E_TEST_IDS.landingRoomCodeInput}
                value={code}
                onChange={(event) => {
                  setCode(normalizeRoomCodeInput(event.target.value));
                  if (joinError) setJoinError('');
                }}
                aria-invalid={joinError ? true : undefined}
                aria-describedby={joinError ? 'room-code-error' : undefined}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                disabled={pending !== null}
                className={
                  'font-mono text-lg uppercase tracking-[0.2em]' +
                  (joinError ? ' lj-nudge' : '')
                }
              />
            </div>
            {joinError && (
              <p
                id="room-code-error"
                role="alert"
                className="text-sm font-semibold text-[var(--danger)]"
              >
                {joinError}
              </p>
            )}
            <Button
              type="submit"
              variant="secondary"
              data-testid={E2E_TEST_IDS.landingJoinButton}
              data-sound="loading"
              className="w-full"
              disabled={busy}
              aria-busy={pending === 'join' ? true : undefined}
            >
              {pending === 'join' ? 'Joining…' : 'Join'}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
