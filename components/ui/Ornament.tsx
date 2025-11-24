import { cn } from '@/lib/utils';

interface OrnamentProps {
  type: 'dagger' | 'section' | 'fleuron' | 'asterism';
  className?: string;
}

export function Ornament({ type, className }: OrnamentProps) {
  const char =
    type === 'dagger'
      ? '†'
      : type === 'section'
        ? '§'
        : type === 'fleuron'
          ? '❦'
          : '⁂';

  return (
    <span
      className={cn(
        'inline-block px-2 text-[var(--color-text-muted)]',
        className
      )}
      aria-hidden="true"
    >
      {char}
    </span>
  );
}
