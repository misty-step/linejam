import { cn } from '@/lib/utils';
import { getUserColor, getUniqueColor } from '@/lib/avatarColor';

interface AvatarProps {
  /** Stable user identifier (guestId or clerkUserId) for color generation */
  stableId: string;
  /** User's display name for aria-label */
  displayName: string;
  /** All stable IDs in room for collision resolution (optional) */
  allStableIds?: string[];
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
}

const SIZES = {
  xs: 'w-5 h-5', // 20px (reduced from 24px)
  sm: 'w-7 h-7', // 28px (reduced from 32px)
  md: 'w-9 h-9', // 36px (reduced from 40px)
  lg: 'w-12 h-12', // 48px (reduced from 56px)
  xl: 'w-16 h-16', // 64px (reduced from 80px)
} as const;

// SVG noise texture for ink-on-paper effect
const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.12'/%3E%3C/svg%3E")`;

/**
 * Player avatar as colored circle.
 * Color derived from stableId with collision resolution when allStableIds provided.
 */
export function Avatar({
  stableId,
  displayName,
  allStableIds,
  size = 'md',
  className,
}: AvatarProps) {
  const color = allStableIds
    ? getUniqueColor(stableId, allStableIds)
    : getUserColor(stableId);

  return (
    <div
      className={cn(
        'rounded-full shrink-0',
        'shadow-[var(--shadow-sm)]', // Hanko seal: hard graphic shadow
        SIZES[size],
        className
      )}
      style={{
        backgroundColor: color,
        backgroundImage: NOISE_TEXTURE,
        backgroundBlendMode: 'overlay',
      }}
      aria-label={`${displayName}'s avatar`}
      role="img"
    />
  );
}
