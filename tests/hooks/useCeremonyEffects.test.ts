// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCeremonyEffects } from '@/hooks/useCeremonyEffects';
import { installMatchMedia } from '@/tests/helpers/matchMedia';

const CEREMONY_MUTED_KEY = 'linejam:ceremony-muted';

// vi.fn().mockReturnValue() can't stand in for a `new`-able constructor, so
// build a real constructor function that copies the fake context's members
// onto `this` the way a real AudioContext instance would expose them.
function createAudioContextCtor(audioContext: Record<string, unknown>) {
  return vi.fn(function (this: Record<string, unknown>) {
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
    localStorage.clear();
    Object.defineProperty(navigator, 'vibrate', {
      value: originalVibrate,
      configurable: true,
    });
    if (originalAudioContext) {
      Object.defineProperty(window, 'AudioContext', {
        value: originalAudioContext,
        configurable: true,
        writable: true,
      });
    } else {
      Reflect.deleteProperty(window, 'AudioContext');
    }
  });

  it('mutes and unmutes, persisting the preference to localStorage each way', () => {
    const { result } = renderHook(() => useCeremonyEffects());

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMuted();
    });
    expect(result.current.isMuted).toBe(true);
    expect(localStorage.getItem(CEREMONY_MUTED_KEY)).toBe('1');

    act(() => {
      result.current.toggleMuted();
    });
    expect(result.current.isMuted).toBe(false);
    expect(localStorage.getItem(CEREMONY_MUTED_KEY)).toBeNull();
  });

  it('setMuted writes the explicit value instead of toggling', () => {
    const { result } = renderHook(() => useCeremonyEffects());

    act(() => {
      result.current.setMuted(true);
    });
    expect(result.current.isMuted).toBe(true);
    expect(localStorage.getItem(CEREMONY_MUTED_KEY)).toBe('1');

    act(() => {
      result.current.setMuted(false);
    });
    expect(result.current.isMuted).toBe(false);
    expect(localStorage.getItem(CEREMONY_MUTED_KEY)).toBeNull();
  });

  it('does not vibrate or play a tone while muted', () => {
    const { result } = renderHook(() => useCeremonyEffects());

    act(() => {
      result.current.setMuted(true);
    });
    act(() => {
      result.current.punctuate('line');
    });

    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('skips haptics gracefully on a device with no vibrate API', () => {
    Reflect.deleteProperty(navigator, 'vibrate');
    expect('vibrate' in navigator).toBe(false);

    const { result } = renderHook(() => useCeremonyEffects());

    expect(() => {
      act(() => {
        result.current.punctuate('line');
      });
    }).not.toThrow();
  });

  it('does not vibrate or play a tone when the reader prefers reduced motion', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useCeremonyEffects());

    expect(result.current.prefersReducedMotion).toBe(true);

    act(() => {
      result.current.punctuate('final-line');
    });

    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it('plays a triangle tone and vibrates the crown pattern for the crown beat', () => {
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
    const audioContext = {
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

    act(() => {
      result.current.punctuate('crown');
    });

    expect(AudioContextCtor).toHaveBeenCalledTimes(1);
    expect(oscillator.type).toBe('triangle');
    expect(oscillator.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(audioContext.destination);
    expect(oscillator.start).toHaveBeenCalledWith(0);
    expect(navigator.vibrate).toHaveBeenCalledWith([16, 40, 22]);
  });

  it('plays a sine tone for a regular line beat', () => {
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
    const audioContext = {
      currentTime: 0,
      createOscillator: vi.fn().mockReturnValue(oscillator),
      createGain: vi.fn().mockReturnValue(gain),
      destination: {},
      close: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(window, 'AudioContext', {
      value: createAudioContextCtor(audioContext),
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useCeremonyEffects());

    act(() => {
      result.current.punctuate('line');
    });

    expect(oscillator.type).toBe('sine');
    expect(navigator.vibrate).toHaveBeenCalledWith(8);
  });
});
