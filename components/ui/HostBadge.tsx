import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HostBadgeProps {
  className?: string;
}

export function HostBadge({ className }: HostBadgeProps) {
  return (
    <div
      role="status"
      aria-label="Room host"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-primary',
        className
      )}
    >
      {/* Crown Icon - Lucide */}
      <Crown className="w-4 h-4 text-primary" aria-hidden="true" />

      {/* Text Label */}
      <span className="text-xs font-semibold">Host</span>
    </div>
  );
}
