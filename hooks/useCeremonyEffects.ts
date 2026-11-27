'use client';

import { useCallback, useEffect, useState } from 'react';
import { playSound, useSound } from '@/lib/audio';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function useCeremonyEffects() {
  const { isMuted } = useSound();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      globalThis.window !== undefined &&
      window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const punctuate = useCallback(() => {
    playSound('sparkle');
    if (isMuted || prefersReducedMotion) return;
    // Haptics follow a trusted gesture only (PRODUCT.md [L1-7.9]); without
    // one, browsers block the call and log an intervention error.
    if (navigator.userActivation?.hasBeenActive === false) return;
    try {
      navigator.vibrate?.([16, 40, 22]);
    } catch {
      // Haptics are optional and independent of the audio/visual ceremony.
    }
  }, [isMuted, prefersReducedMotion]);

  return { punctuate };
}
