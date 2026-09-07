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
  const { mint, peach, lavender } = AVATAR_COLORS;
  const ink = outlined ? 'var(--color-text-primary)' : AVATAR_COLORS.ink;

  switch (avatarId) {
    case 'pip':
      return (
        <>
          <path
            d="M27 11Q32 3 37 11L56 45Q60 54 50 55H14Q4 54 8 45Z"
            fill={outlined ? 'none' : peach}
          />
          <g fill={ink} stroke="none">
            <circle cx="25" cy="34" r="2.5" />
            <circle cx="39" cy="34" r="2.5" />
          </g>
          <path d="M26 43Q32 49 38 43" fill="none" />
        </>
      );
    case 'moss':
      return (
        <>
          <rect
            x="9"
            y="11"
            width="46"
            height="44"
            rx="10"
            fill={outlined ? 'none' : mint}
          />
          <path d="M20 31Q24 26 28 31M36 31Q40 26 44 31" fill="none" />
          <path d="M26 40H38Q37 48 32 48Q27 48 26 40Z" fill={ink} />
          <path d="M17 17H24" fill="none" />
        </>
      );
    case 'pebble':
      return (
        <>
          <ellipse
            cx="32"
            cy="36"
            rx="27"
            ry="19"
            fill={outlined ? 'none' : lavender}
          />
          <path d="M18 34H25M39 34H46M28 43Q32 46 36 43" fill="none" />
          <g fill={peach} stroke="none">
            <ellipse cx="17" cy="40" rx="3" ry="2" />
            <ellipse cx="47" cy="40" rx="3" ry="2" />
          </g>
        </>
      );
    case 'orbit':
      return (
        <>
          <ellipse
            cx="32"
            cy="34"
            rx="29"
            ry="11"
            transform="rotate(-24 32 34)"
            fill="none"
          />
          <circle cx="32" cy="30" r="21" fill={outlined ? 'none' : lavender} />
          <g fill={ink} stroke="none">
            <circle cx="25" cy="27" r="2.5" />
            <circle cx="39" cy="27" r="2.5" />
          </g>
          <path d="M28 35Q32 39 36 35" fill="none" />
          <path
            d="M6 42Q18 55 58 24"
            fill="none"
            stroke={ink}
            strokeWidth="6"
          />
          <path
            d="M6 42Q18 55 58 24"
            fill="none"
            stroke={mint}
            strokeWidth="3"
          />
          <circle cx="53" cy="13" r="4" fill={peach} />
        </>
      );
    case 'sprout':
      return (
        <>
          <path d="M32 20V9M32 16Q18 17 19 5Q30 4 32 16Z" fill={mint} />
          <path d="M32 13Q34 3 45 6Q44 17 32 17" fill={mint} />
          <path
            d="M15 37A17 17 0 0 1 49 37V49Q49 56 42 56H22Q15 56 15 49Z"
            fill={outlined ? 'none' : peach}
          />
          <g fill={ink} stroke="none">
            <ellipse cx="25" cy="37" rx="2.5" ry="3.5" />
            <ellipse cx="39" cy="37" rx="2.5" ry="3.5" />
          </g>
          <path d="M27 46Q32 51 37 46" fill="none" />
        </>
      );
    case 'sunny':
      return (
        <>
          <path
            d="M32 4L38 14L49 9L50 21L61 25L54 34L59 45L47 47L43 59L32 53L21 59L17 47L5 45L10 34L3 25L14 21L15 9L26 14Z"
            fill={outlined ? 'none' : peach}
          />
          <circle cx="24" cy="30" r="2.5" fill={ink} stroke="none" />
          <path d="M36 30Q40 25 44 30M25 39Q32 47 39 39" fill="none" />
        </>
      );
    case 'ziggy':
      return (
        <>
          <path
            d="M29 5H48L38 24H55L27 59L30 39H10Z"
            fill={outlined ? 'none' : mint}
          />
          <g fill={ink} stroke="none">
            <circle cx="26" cy="29" r="2.5" />
            <circle cx="37" cy="29" r="2.5" />
          </g>
          <path d="M27 36Q31 40 35 35" fill="none" />
        </>
      );
    case 'plum':
      return (
        <>
          <path
            d="M22 7H42L55 23V43L42 57H22L9 43V23Z"
            fill={outlined ? 'none' : lavender}
          />
          <path d="M19 23L26 21M38 21L45 23" fill="none" />
          <g fill={ink} stroke="none">
            <circle cx="24" cy="31" r="2.5" />
            <circle cx="40" cy="31" r="2.5" />
          </g>
          <ellipse cx="32" cy="43" rx="4" ry="5" fill={ink} />
          <path d="M29 11H35" fill="none" stroke={peach} strokeWidth="4" />
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
