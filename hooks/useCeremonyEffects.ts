'use client';

import { useCallback, useEffect, useState } from 'react';

type CeremonyEffect = 'line' | 'final-line' | 'crown';

const CEREMONY_MUTED_KEY = 'linejam:ceremony-muted';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const HAPTIC_PATTERNS: Record<CeremonyEffect, VibratePattern> = {
  line: 8,
  'final-line': [14, 30, 18],
  crown: [16, 40, 22],
};

const TONE_FREQUENCIES: Record<CeremonyEffect, number> = {
  line: 440,
  'final-line': 660,
  crown: 740,
};

function readMutedPreference() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(CEREMONY_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMutedPreference(isMuted: boolean) {
  if (typeof window === 'undefined') return;

  try {
    if (isMuted) {
      window.localStorage.setItem(CEREMONY_MUTED_KEY, '1');
    } else {
      window.localStorage.removeItem(CEREMONY_MUTED_KEY);
    }
  } catch {
    // Storage is a convenience; the in-memory toggle still works.
  }
}

function readReducedMotionPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function playTone(effect: CeremonyEffect) {
  if (typeof window === 'undefined') return;

  type AudioWindow = Window &
    typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
  const AudioContextCtor =
    window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = effect === 'crown' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(TONE_FREQUENCIES[effect], now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);

    window.setTimeout(() => {
      void context.close().catch(() => {});
    }, 160);
  } catch {
    // Audio is best-effort; haptics and visual ceremony still carry the beat.
  }
}

export function useCeremonyEffects() {
  const [isMuted, setIsMuted] = useState(readMutedPreference);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    readReducedMotionPreference
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const setMuted = useCallback((nextMuted: boolean) => {
    setIsMuted(nextMuted);
    writeMutedPreference(nextMuted);
  }, []);

  const toggleMuted = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      writeMutedPreference(next);
      return next;
    });
  }, []);

  const punctuate = useCallback(
    (effect: CeremonyEffect) => {
      if (isMuted || prefersReducedMotion) return;

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(HAPTIC_PATTERNS[effect]);
      }
      playTone(effect);
    },
    [isMuted, prefersReducedMotion]
  );

  return {
    isMuted,
    prefersReducedMotion,
    punctuate,
    setMuted,
    toggleMuted,
  };
}
