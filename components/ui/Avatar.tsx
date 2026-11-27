import { cn } from '@/lib/utils';
import {
  AVATAR_NAMES,
  AVATAR_EMBLEMS,
  getDefaultAvatarId,
  isAvatarId,
  type AvatarId,
} from '@/lib/avatars';
import { FOLIO_EMBLEM_SVG } from '@/lib/design/folio.generated';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

interface AvatarProps {
  /** Stable identity used only when no room-scoped selection is available. */
  stableId: string;
  /** Kept for call sites; the emblem's own name is its accessible label. */
  displayName?: string;
  avatarId?: AvatarId;
  size?: AvatarSize;
  /** Accent marks the selected emblem or the current player ([D1-2.4]). */
  tone?: 'ink' | 'accent';
  className?: string;
}

const SIZE_PX = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
  hero: 56,
} as const satisfies Record<AvatarSize, number>;

/**
 * A player's cast emblem: the locked folio SVG, verbatim, colored only through
 * currentColor. It supplements a pen name and never replaces it.
 */
export function Avatar({
  stableId,
  avatarId,
  size = 'md',
  tone = 'ink',
  className,
}: AvatarProps) {
  // A newer server during a rolling deploy may send an id this bundle cannot draw.
  const chosen =
    avatarId && isAvatarId(avatarId) ? avatarId : getDefaultAvatarId(stableId);
  const px = SIZE_PX[size];
  return (
    <span
      role="img"
      aria-label={AVATAR_NAMES[chosen]}
      data-emblem={AVATAR_EMBLEMS[chosen]}
      className={cn(
        'lj-svg-fill inline-block shrink-0 transition-colors duration-[var(--duration-micro)]',
        tone === 'accent' ? 'text-[var(--accent)]' : 'text-[var(--ink)]',
        className
      )}
      style={{ width: px, height: px }}
      dangerouslySetInnerHTML={{
        __html: FOLIO_EMBLEM_SVG[AVATAR_EMBLEMS[chosen]],
      }}
    />
  );
}
