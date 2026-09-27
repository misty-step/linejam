import { cn } from '@/lib/utils';

interface HostBadgeProps {
  className?: string;
}

/** The written host label; the host's character wears the crown beside it. */
export function HostBadge({ className }: HostBadgeProps) {
  return (
    <div
      role="status"
      aria-label="Room host"
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2 py-1 text-primary',
        className
      )}
    >
      <span className="text-xs font-semibold">Host</span>
    </div>
  );
}
