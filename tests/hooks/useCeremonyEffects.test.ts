// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, Fragment } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { createAudioController } from '@parlor/web/audio';
import { useCeremonyEffects } from '@/hooks/useCeremonyEffects';
import { SoundControl } from '@/components/SoundControl';
import {
  bindSoundFeedback,
  playSound,
  setSoundMuted,
  SOUND_MUTED_KEY,
} from '@/lib/audio';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

const engine = {
  play: vi.fn(),
  setEnabled: vi.fn(),
  setVolume: vi.fn(),
  bind: vi.fn(),
};

// happy-dom cannot generate trusted browser input. This fixture models that
// event boundary; real pointer/keyboard and rendered audio require browser QA.
function trustedClick(target: Element, detail = 1) {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    detail,
  });
  Object.defineProperty(event, 'isTrusted', { value: true });
  target.dispatchEvent(event);
}

describe('shared Cuelume feedback', () => {
  let unbind: () => void;
  const originalActivation = Object.getOwnPropertyDescriptor(
    navigator,
    'userActivation'
  );
  const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');

  beforeEach(() => {
    localStorage.clear();
    unbind = bindSoundFeedback(
      document,
      createAudioController({ enabled: true, storage: null, engine })
    );
    setSoundMuted(false);
    engine.play.mockReset();
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: true, isActive: false },
    });
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(),
    });
    installMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    unbind();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    localStorage.clear();
    if (originalActivation)
      Object.defineProperty(navigator, 'userActivation', originalActivation);
    else Reflect.deleteProperty(navigator, 'userActivation');
    if (originalVibrate)
      Object.defineProperty(navigator, 'vibrate', originalVibrate);
    else Reflect.deleteProperty(navigator, 'vibrate');
  });

  it('drops pre-gesture events and plays later remote cues without transient activation', async () => {
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: false, isActive: false },
    });
    playSound('ready');
    expect(engine.play).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: true, isActive: true },
    });
    const button = document.createElement('button');
    document.body.append(button);
    trustedClick(button);
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { hasBeenActive: true, isActive: false },
    });
    await Promise.resolve();
    playSound('ready');
    expect(engine.play.mock.calls.map(([sound]) => sound)).toEqual([
      'release',
      'ready',
    ]);
  });

  it('shares an explicit mute across controls and remounts, then restores sound on re-enable', () => {
    const { unmount } = render(
      createElement(
        Fragment,
        null,
        createElement(SoundControl),
        createElement(SoundControl)
      )
    );
    fireEvent.click(screen.getAllByRole('button')[0]);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(localStorage.getItem(SOUND_MUTED_KEY)).toBe('1');
    playSound('success');
    expect(engine.play).not.toHaveBeenCalled();
    unmount();

    render(createElement(SoundControl));
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button'));
    playSound('ready');
    expect(engine.play.mock.calls.map(([sound]) => sound)).toEqual([
      'toggle',
      'ready',
    ]);
    expect(localStorage.getItem(SOUND_MUTED_KEY)).toBe('0');
  });

  it('honors legacy persisted mute changes from another tab without remounting', () => {
    render(createElement(SoundControl));
    act(() => {
      localStorage.setItem(SOUND_MUTED_KEY, '1');
      window.dispatchEvent(
        new StorageEvent('storage', { key: SOUND_MUTED_KEY, newValue: '1' })
      );
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    playSound('bloom');
    expect(engine.play).not.toHaveBeenCalled();

    act(() => {
      localStorage.setItem(SOUND_MUTED_KEY, '0');
      window.dispatchEvent(
        new StorageEvent('storage', { key: SOUND_MUTED_KEY, newValue: '0' })
      );
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    playSound('bloom');
    expect(engine.play.mock.calls.map(([sound]) => sound)).toEqual(['bloom']);
  });

  it('keeps reduced-motion audio audible while suppressing haptics, and mute suppresses both', () => {
    const media = installMatchMedia(true);
    const { result } = renderHook(() => useCeremonyEffects());
    act(() => result.current.punctuate());
    expect(engine.play.mock.calls.map(([sound]) => sound)).toEqual(['sparkle']);
    expect(navigator.vibrate).not.toHaveBeenCalled();

    act(() => media.dispatch(false));
    act(() => result.current.punctuate());
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    act(() => setSoundMuted(true));
    act(() => result.current.punctuate());
    expect(engine.play).toHaveBeenCalledTimes(2);
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it('plays one cue per enabled activation, never hover, typing, repeat, or programmatic clicks', () => {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.append(icon);
    document.body.append(button);
    trustedClick(icon);
    button.dataset.sound = 'loading';
    trustedClick(button, 0); // keyboard-generated click uses the same path
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    button.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    button.click();
    button.disabled = true;
    trustedClick(button);
    button.disabled = false;
    button.setAttribute('aria-disabled', 'true');
    trustedClick(button);
    button.removeAttribute('aria-disabled');
    button.dataset.sound = 'none';
    trustedClick(button);
    delete button.dataset.sound;
    button.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        repeat: true,
        bubbles: true,
      })
    );
    trustedClick(button, 0);
    button.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })
    );
    const input = document.createElement('input');
    document.body.append(input);
    trustedClick(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true })
    );
    expect(engine.play.mock.calls.map(([sound]) => sound)).toEqual([
      'release',
      'loading',
    ]);
  });

  it('does not duplicate listeners on remount or let failed playback interrupt the action', () => {
    unbind();
    unbind = bindSoundFeedback(document);
    const button = document.createElement('button');
    const action = vi.fn();
    button.addEventListener('click', action);
    document.body.append(button);
    engine.play.mockImplementation(() => {
      throw new Error('Audio unavailable');
    });
    trustedClick(button);
    expect(action).toHaveBeenCalledTimes(1);
    expect(engine.play).toHaveBeenCalledTimes(1);
  });

  it('keeps shared mute effective when storage is denied', () => {
    render(
      createElement(
        Fragment,
        null,
        createElement(SoundControl),
        createElement(SoundControl)
      )
    );
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
    fireEvent.click(screen.getAllByRole('button')[0]);
    playSound('error');
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(engine.play).not.toHaveBeenCalled();
  });
});
