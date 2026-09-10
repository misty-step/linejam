'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '@/lib/audio';
import { cn } from '@/lib/utils';

export function SoundControl({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { isMuted, toggleMuted } = useSound();
  const label = isMuted ? 'Turn sound on' : 'Mute sound';

  return (
    <button
      type="button"
      data-sound="none"
      onClick={toggleMuted}
      aria-label={label}
      aria-pressed={!isMuted}
      title={isMuted ? 'Sound off — turn on' : 'Sound on — mute'}
      className={cn(
        'inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-2 rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 print:hidden',
        showLabel && 'px-3 text-sm',
        className
      )}
    >
      {isMuted ? (
        <VolumeX className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Volume2 className="h-5 w-5" aria-hidden="true" />
      )}
      {showLabel && <span>{isMuted ? 'Sound off' : 'Sound on'}</span>}
    </button>
  );
}
