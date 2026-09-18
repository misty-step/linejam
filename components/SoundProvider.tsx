'use client';

import { useEffect, type ReactNode } from 'react';
import { bindSoundFeedback } from '@/lib/audio';

export function SoundProvider({ children }: { children: ReactNode }) {
  useEffect(() => bindSoundFeedback(document), []);
  return children;
}
