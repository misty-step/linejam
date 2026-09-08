import { cn } from '@/lib/utils';

export function Brand({
  symbolOnly = false,
  className,
}: {
  symbolOnly?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-2.5 text-[1.65rem] text-primary',
        className
      )}
    >
      <svg
        width="34"
        height="32"
        viewBox="0 0 40 36"
        fill="currentColor"
        aria-hidden="true"
        className="h-[1.05em] w-[1.1em] shrink-0"
      >
        <path d="M3 7a5 5 0 0 1 5-5h9a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5h-5l-7 6V20a5 5 0 0 1-2-4Z" />
        <path d="M25 11h7a5 5 0 0 1 5 5v10a5 5 0 0 1-2 4v5l-6-5h-6a5 5 0 0 1-5-5v-1h1a6 6 0 0 0 6-6Z" />
      </svg>
      <span
        className={
          symbolOnly
            ? 'sr-only'
            : 'font-display font-medium leading-none tracking-tight'
        }
      >
        Linejam
      </span>
    </span>
  );
}
