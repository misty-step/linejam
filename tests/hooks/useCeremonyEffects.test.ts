// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCeremonyEffects } from '@/hooks/useCeremonyEffects';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

interface FakeOscillator {
  type: string;
  frequency: { setValueAtTime: Mock };
  connect: Mock;
  start: Mock;
  stop: Mock;
}

interface FakeGain {
  gain: {
    setValueAtTime: Mock;
    exponentialRampToValueAtTime: Mock;
  };
  connect: Mock;
}

interface FakeAudioContext {
  currentTime: number;
  createOscillator: Mock<() => FakeOscillator>;
  createGain: Mock<() => FakeGain>;
  destination: object;
  close: Mock<() => Promise<void>>;
}

// vi.fn().mockReturnValue() can't stand in for a `new`-able constructor, so
// build a real constructor function that copies the fake context's members
// onto `this` the way a real AudioContext instance would expose them.
function createAudioContextCtor(audioContext: FakeAudioContext) {
  return vi.fn(function (this: FakeAudioContext) {
    Object.assign(this, audioContext);
  });
}

describe('useCeremonyEffects', () => {
  let originalVibrate: Navigator['vibrate'];
  let originalAudioContext: typeof window.AudioContext | undefined;

  beforeEach(() => {
    localStorage.clear();
    installMatchMedia(false);
    originalVibrate = navigator.vibrate;
    originalAudioContext = window.AudioContext;
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    Object.defineProperty(navigator, 'vibrate', {
      value: originalVibrate,
      configurable: true,
      writable: true,
    });
    if (originalAudioContext !== undefined) {
      Object.defineProperty(window, 'AudioContext', {
        value: originalAudioContext,
        configurable: true,
        writable: true,
      });
    } else {
      Reflect.deleteProperty(window, 'AudioContext');
    }
  });

  it('requires opt-in and preserves that choice across remounts', () => {
    const first = renderHook(() => useCeremonyEffects());
    act(() => first.result.current.punctuate('crown'));
    expect(navigator.vibrate).not.toHaveBeenCalled();
    act(() => first.result.current.toggleMuted());
    first.unmount();
    const second = renderHook(() => useCeremonyEffects());
    act(() => second.result.current.punctuate('crown'));
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    act(() => second.result.current.toggleMuted());
    second.unmount();
    const third = renderHook(() => useCeremonyEffects());
    act(() => third.result.current.punctuate('crown'));
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  it('does not vibrate or play a tone when the reader prefers reduced motion', () => {
    installMatchMedia(true);
    const AudioContextCtor = vi.fn();
    Object.defineProperty(window, 'AudioContext', {
      value: AudioContextCtor,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useCeremonyEffects());

    act(() => result.current.setMuted(false));
    act(() => {
      result.current.punctuate('crown');
    });

    expect(navigator.vibrate).not.toHaveBeenCalled();
    expect(AudioContextCtor).not.toHaveBeenCalled();
  });

  it('keeps opted-in feedback brief and releases the audio context', () => {
    vi.useFakeTimers();
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const audioContext: FakeAudioContext = {
      currentTime: 0,
      createOscillator: vi.fn().mockReturnValue(oscillator),
      createGain: vi.fn().mockReturnValue(gain),
      destination: {},
      close: vi.fn().mockResolvedValue(undefined),
    };
    const AudioContextCtor = createAudioContextCtor(audioContext);
    Object.defineProperty(window, 'AudioContext', {
      value: AudioContextCtor,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useCeremonyEffects());
    act(() => result.current.setMuted(false));

    act(() => {
      result.current.punctuate('crown');
    });

    expect(AudioContextCtor).toHaveBeenCalledTimes(1);
    expect(oscillator.start).toHaveBeenCalledTimes(1);
    expect(oscillator.stop.mock.calls[0][0]).toBeGreaterThan(0);
    expect(oscillator.stop.mock.calls[0][0]).toBeLessThanOrEqual(0.25);
    act(() => vi.advanceTimersByTime(250));
    expect(audioContext.close).toHaveBeenCalledTimes(1);
  });
});
