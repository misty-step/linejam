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
  /** Show as outline only (hollow) instead of filled */
  outlined?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Tiny accent dots - name is primary, color is secondary identifier
const SIZES = {
  xs: 'w-2 h-2', // 8px - RevealPhase lists
  sm: 'w-2.5 h-2.5', // 10px - WaitingScreen indicators
  md: 'w-3 h-3', // 12px - Lobby player list
  lg: 'w-4 h-4', // 16px - Emphasized contexts
  xl: 'w-5 h-5', // 20px - Profile page
} as const;

/**
 * Color accent dot for player identification.
 * Tiny marker where name is primary; color provides multiplayer distinction.
 */
export function Avatar({
  stableId,
  displayName,
  allStableIds,
  size = 'md',
  outlined = false,
  className,
}: AvatarProps) {
  const color = allStableIds
    ? getUniqueColor(stableId, allStableIds)
    : getUserColor(stableId);

  return (
    <div
      className={cn(
        'rounded-full shrink-0 transition-colors',
        SIZES[size],
        outlined && 'border-2 box-border',
        className
      )}
      style={
        outlined
          ? { borderColor: color, backgroundColor: 'transparent' }
          : { backgroundColor: color }
      }
      aria-label={`${displayName}'s color marker`}
      role="img"
    />
  );
}
