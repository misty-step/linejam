import { cn } from '@/lib/utils';
import {
  AVATAR_COLORS,
  getDefaultAvatarId,
  type AvatarId,
} from '@/lib/avatars';

interface AvatarProps {
  /** Stable identity used only when no room-scoped selection is available. */
  stableId: string;
  /** User's display name for aria-label */
  displayName: string;
  avatarId?: AvatarId;
  /** Retained for callers that also use room-wide attribution colors. */
  allStableIds?: string[];
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Draw the character's body as an outline. */
  outlined?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const SIZES = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-[72px] h-[72px]',
} as const;

function AvatarCharacter({
  avatarId,
  outlined,
}: {
  avatarId: AvatarId;
  outlined: boolean;
}) {
  const ink = outlined ? 'var(--color-text-primary)' : AVATAR_COLORS.ink;
  const mint = outlined ? 'none' : AVATAR_COLORS.mint;
  const peach = outlined ? 'none' : AVATAR_COLORS.peach;
  const lavender = outlined ? 'none' : AVATAR_COLORS.lavender;

  switch (avatarId) {
    case 'pip':
      return (
        <>
          <path d="M16 36Q6 41 5 33M45 31Q57 31 56 22L55 18M23 54L21 59H16M39 54L42 58H47" />
          <path
            d="M27 12Q32 4 36 13L52 43Q57 52 47 53L17 54Q8 54 11 45Z"
            fill={peach}
          />
          <path d="M27 12Q32 4 36 13L40 21Q31 25 22 23Z" fill={mint} />
          <circle cx="24" cy="33" r="2.5" fill={ink} stroke="none" />
          <path d="M34 32Q38 28 41 31" />
          <path
            d="M25 40Q32 43 40 37Q38 48 31 46Q27 45 25 40Z"
            fill={ink}
            stroke="none"
          />
        </>
      );
    case 'moss':
      return (
        <>
          <path d="M12 30Q4 30 5 38L9 40M53 29Q61 30 58 20M21 54L18 59H25M40 53L43 58H49" />
          <path
            d="M20 11L43 9Q52 9 53 19L54 43Q54 51 44 53L21 54Q12 54 11 44L10 23Q9 13 20 11Z"
            fill={mint}
          />
          <path d="M19 30Q23 24 27 29M35 28Q39 23 44 28" />
          <path
            d="M23 36Q32 39 42 34Q40 47 33 47Q26 47 23 36Z"
            fill={ink}
            stroke="none"
          />
          <path
            d="M29 43Q34 39 39 42Q37 47 33 47Q30 47 29 43Z"
            fill={peach}
            stroke="none"
          />
        </>
      );
    case 'pebble':
      return (
        <>
          <path d="M18 53Q15 59 10 56M41 52Q47 58 54 55M56 34Q62 32 59 25L56 27" />
          <path
            d="M7 31C13 20 29 17 38 20C44 22 45 27 52 29Q60 33 58 43Q56 52 45 52L19 53Q7 53 6 43Q4 37 7 31Z"
            fill={lavender}
          />
          <g fill={peach} stroke="none">
            <ellipse cx="17" cy="39" rx="3.5" ry="2.5" />
            <ellipse cx="45" cy="37" rx="3.5" ry="2.5" />
          </g>
          <path d="M17 32Q21 35 25 31M35 31Q39 33 43 29M28 39Q31 42 34 38" />
          <path d="M8 42Q16 49 23 43" />
        </>
      );
    case 'orbit':
      return (
        <>
          <path d="M12 29C5 31 2 36 5 40M49 18C56 16 61 19 59 24" />
          <path
            d="M14 39C9 32 10 19 18 12C27 4 41 8 48 18C55 28 50 42 41 47C31 53 20 49 14 39Z"
            fill={lavender}
          />
          <path d="M35 18Q39 15 43 19" />
          <g fill={ink} stroke="none">
            <ellipse cx="25" cy="26" rx="2.5" ry="3" />
            <ellipse cx="38" cy="25" rx="2.5" ry="3" />
          </g>
          <path d="M28 33Q32 36 36 31" />
          <path
            d="M5 40C13 47 45 36 59 24L58 31C45 43 16 55 6 46Q3 44 5 40Z"
            fill={mint}
          />
          <circle cx="54" cy="9" r="4.5" fill={peach} />
        </>
      );
    case 'sprout':
      return (
        <>
          <path d="M18 34Q9 37 6 30M47 35Q56 38 58 30" />
          <path d="M31 20C19 21 13 14 17 5C28 5 34 10 31 20Z" fill={mint} />
          <path d="M32 20C31 9 39 5 49 9C47 19 40 24 32 20Z" fill={mint} />
          <path d="M31 25Q33 20 27 14" />
          <path
            d="M30 23C39 20 47 27 48 37C49 43 44 46 41 49L43 57Q38 60 35 54L32 49L27 55Q23 59 20 55L23 48C17 44 15 40 17 33Q20 24 30 23Z"
            fill={peach}
          />
          <g fill={ink} stroke="none">
            <ellipse cx="25" cy="35" rx="2.5" ry="3.5" />
            <ellipse cx="38" cy="35" rx="2.5" ry="3.5" />
          </g>
          <path
            d="M27 42Q32 46 37 42Q35 49 32 48Q28 47 27 42Z"
            fill={ink}
            stroke="none"
          />
        </>
      );
    case 'sunny':
      return (
        <>
          <path
            d="M30 8Q33 2 37 12L40 17L49 12Q56 9 53 18L51 25L58 29Q64 33 56 37L50 40L51 49Q52 57 44 52L37 48L32 56Q28 63 25 54L22 46L13 48Q5 50 10 41L14 35L7 29Q1 24 11 22L20 21L20 12Q20 5 27 12Z"
            fill={peach}
          />
          <path d="M21 31Q24 25 28 30M36 30Q40 24 43 29" />
          <path
            d="M25 37Q33 41 41 35Q40 46 33 46Q27 45 25 37Z"
            fill={ink}
            stroke="none"
          />
        </>
      );
    case 'ziggy':
      return (
        <>
          <path d="M19 25L9 23L5 29M46 34L54 37L59 31M29 53L37 58L44 55" />
          <path
            d="M30 7Q31 5 35 6L48 7Q51 7 49 10L40 23H51Q55 23 52 27L29 56Q25 61 26 54L29 40H13Q9 40 12 36Z"
            fill={mint}
          />
          <path d="M23 22L30 24M34 28L41 26" />
          <circle cx="26" cy="29" r="2.5" fill={ink} stroke="none" />
          <path d="M27 35Q33 39 38 33" />
        </>
      );
    case 'plum':
      return (
        <>
          <path d="M9 32Q3 37 8 43L13 41M21 53L19 58H25M40 53L43 58H37" />
          <path
            d="M24 8Q26 7 29 8L43 11Q46 12 47 15L54 28Q55 31 54 34L49 46Q48 49 45 50L33 56Q30 57 27 55L14 49Q11 48 11 45L7 31Q6 28 8 25L16 13Q18 10 24 8Z"
            fill={lavender}
          />
          <path
            d="M16 13Q18 10 24 8Q26 7 29 8L43 11L36 18L23 17Z"
            fill={peach}
          />
          <path d="M18 24L25 21M37 20L44 23" />
          <g fill={ink} stroke="none">
            <circle cx="24" cy="31" r="2.5" />
            <circle cx="39" cy="30" r="2.5" />
            <ellipse cx="32" cy="41" rx="3.5" ry="4.5" />
          </g>
          <path d="M53 34Q59 42 48 45L43 40" />
        </>
      );
  }
}

/** A room-scoped character that supplements, rather than replaces, a name. */
export function Avatar({
  stableId,
  displayName,
  avatarId,
  size = 'md',
  outlined = false,
  className,
}: AvatarProps) {
  const selectedAvatar = avatarId ?? getDefaultAvatarId(stableId);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={cn('shrink-0', SIZES[size], className)}
      fill="none"
      stroke={outlined ? 'var(--color-text-primary)' : AVATAR_COLORS.ink}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={`${displayName}'s avatar`}
      role="img"
      focusable="false"
    >
      <AvatarCharacter avatarId={selectedAvatar} outlined={outlined} />
    </svg>
  );
}
