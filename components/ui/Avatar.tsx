import { cn } from '@/lib/utils';
import {
  currentAvatarId,
  getDefaultAvatarId,
  type StoredAvatarId,
} from '@/lib/avatars';
import {
  AVATAR_ART,
  AVATAR_PROP_ART,
  type AvatarArtPart,
  type AvatarMood,
  type AvatarProp,
  type AvatarVariant,
} from './avatarArt';

export type { AvatarMood, AvatarProp };

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

interface AvatarProps {
  /** Stable identity used only when no room-scoped selection is available. */
  stableId: string;
  /** User's display name for aria-label */
  displayName: string;
  /** A stored choice; retired first-cast ids draw as their Pen Pals successor. */
  avatarId?: StoredAvatarId;
  /** Retained for callers that also use room-wide attribution colors. */
  allStableIds?: string[];
  /** Size variant */
  size?: AvatarSize;
  /** The face follows the player's state; it never replaces the written status. */
  mood?: AvatarMood;
  /** A prop beside the status word: crown, pencil, note, moon or book. */
  prop?: AvatarProp;
  /** Draw the character's body as an outline. */
  outlined?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Optical sizes. Small sizes use the simplified drawing and relatively heavier ink; the
 * sticker edge keeps plum outlines legible on the dark page. Widths are in the 100 unit box.
 */
const OPTICAL = {
  xs: { px: 24, variant: 'small', ink: 7.08, edge: 5 },
  sm: { px: 32, variant: 'small', ink: 6.25, edge: 4.45 },
  md: { px: 44, variant: 'regular', ink: 5.23, edge: 3.98 },
  lg: { px: 56, variant: 'regular', ink: 4.55, edge: 3.53 },
  xl: { px: 72, variant: 'regular', ink: 3.96, edge: 3.19 },
  hero: { px: 112, variant: 'large', ink: 3.1, edge: 2.66 },
} as const satisfies Record<
  AvatarSize,
  { px: number; variant: AvatarVariant; ink: number; edge: number }
>;

const INK = '#39234E';
const EDGE = 'var(--avatar-edge)';
const HOLLOW = 'var(--color-background)';

/** The light contour behind a part, so the whole character reads as one sticker. */
function edgePath(part: AvatarArtPart, ink: number, edge: number, key: string) {
  if (part.kind === 'fill' || part.noEdge) return null;
  const inkWidth = part.kind === 'dot' ? ink : ink * (part.weight ?? 1);
  return (
    <path
      key={key}
      d={part.d}
      transform={part.transform}
      fill={part.kind === 'line' ? 'none' : EDGE}
      stroke={EDGE}
      strokeWidth={inkWidth + 2 * edge}
    />
  );
}

function artPath(
  part: AvatarArtPart,
  ink: number,
  outlined: boolean,
  key: string
) {
  // Spectators keep only the drawn lines: no color patches, cheeks or tongues.
  if (outlined && (part.kind === 'fill' || part.soft)) return null;
  const inkColor = outlined ? 'currentColor' : INK;
  const color = part.fill === 'ink' ? INK : part.fill;
  const common = {
    d: part.d,
    transform: part.transform,
    opacity: part.opacity,
  };
  switch (part.kind) {
    case 'shape':
      return (
        <path
          key={key}
          {...common}
          fill={part.fill === 'ink' ? inkColor : outlined ? HOLLOW : color}
          stroke={inkColor}
          strokeWidth={ink * (part.weight ?? 1)}
        />
      );
    case 'line':
      return (
        <path
          key={key}
          {...common}
          fill="none"
          stroke={outlined ? inkColor : (part.color ?? INK)}
          strokeWidth={ink * (part.weight ?? 1)}
        />
      );
    case 'dot':
      return <path key={key} {...common} fill={outlined ? inkColor : color} />;
    case 'fill':
      return <path key={key} {...common} fill={color} />;
  }
}

/** A room-scoped character that supplements, rather than replaces, a name. */
export function Avatar({
  stableId,
  displayName,
  avatarId,
  size = 'md',
  mood = 'idle',
  prop,
  outlined = false,
  className,
}: AvatarProps) {
  const chosen =
    avatarId === undefined
      ? getDefaultAvatarId(stableId)
      : currentAvatarId(avatarId);
  // A newer server during a rolling deploy may send an id this bundle cannot draw.
  const art =
    AVATAR_ART[
      Object.hasOwn(AVATAR_ART, chosen) ? chosen : getDefaultAvatarId(stableId)
    ];
  const { px, variant, ink, edge } = OPTICAL[size];
  const parts = art.variants[variant].map((index) => art.parts[index]);
  const face = art.faces[variant][mood];
  // Props sit beside the status word; the small drawings leave them out.
  const propArt =
    prop && variant !== 'small'
      ? { transform: art.props[prop], parts: AVATAR_PROP_ART[prop] }
      : null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={px}
      height={px}
      className={cn(
        'shrink-0 overflow-visible',
        outlined && 'text-text-secondary',
        className
      )}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={`${displayName}'s avatar`}
      role="img"
      focusable="false"
    >
      {!outlined &&
        parts.map((part, index) => edgePath(part, ink, edge, `e${index}`))}
      {parts.map((part, index) => artPath(part, ink, outlined, `a${index}`))}
      <g transform={face.transform}>
        {face.parts.map((part, index) =>
          artPath(part, ink, outlined, `f${index}`)
        )}
      </g>
      {propArt && (
        <g transform={propArt.transform}>
          {!outlined &&
            propArt.parts.map((part, index) =>
              edgePath(part, ink, edge, `pe${index}`)
            )}
          {propArt.parts.map((part, index) =>
            artPath(part, ink, false, `pa${index}`)
          )}
        </g>
      )}
    </svg>
  );
}
