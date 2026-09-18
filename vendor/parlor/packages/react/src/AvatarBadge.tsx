import { type CSSProperties } from "react";

export interface AvatarDescriptor {
  readonly key: string;
  readonly background: string;
  readonly foreground: string;
  readonly shape: string;
}

export type AvatarBadgeSize = "small" | "medium" | "large" | number;

export interface AvatarBadgeProps {
  descriptor: AvatarDescriptor;
  /** The player name shown as the avatar's accessible name and initials. */
  name?: string;
  /** Alias for name when a caller uses an accessibility-oriented vocabulary. */
  label?: string;
  /** Explicit accessible name; takes precedence over name and label. */
  "aria-label"?: string;
  /** Set when the badge is decorative and nearby text already names the player. */
  decorative?: boolean;
  size?: AvatarBadgeSize;
  className?: string;
  title?: string;
}

function initialsFor(name: string | undefined): string {
  const firstCharacter = name?.trim().match(/^\p{L}|^\p{N}/u)?.[0];
  return firstCharacter?.toUpperCase() ?? "?";
}

function sizeValue(size: AvatarBadgeSize): string {
  if (typeof size === "number") {
    return `${size}px`;
  }
  return size === "small" ? "2rem" : size === "large" ? "3.5rem" : "2.75rem";
}

/** A themeable, text-backed avatar with an explicit accessible name. */
export function AvatarBadge({
  descriptor,
  name,
  label,
  "aria-label": ariaLabel,
  decorative = false,
  size = "medium",
  className,
  title,
}: AvatarBadgeProps) {
  const accessibleName = ariaLabel ?? name ?? label ?? "Avatar";
  const displayTitle = title ?? (decorative ? undefined : accessibleName);
  const style = {
    "--parlor-avatar-background": descriptor.background,
    "--parlor-avatar-foreground": descriptor.foreground,
    "--parlor-avatar-size": sizeValue(size),
  } as CSSProperties;
  const classes = ["parlor-avatar-badge", `parlor-avatar-badge--${descriptor.shape}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      data-avatar-key={descriptor.key}
      data-shape={descriptor.shape}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : accessibleName}
      aria-hidden={decorative ? true : undefined}
      title={displayTitle}
      style={style}
    >
      <span aria-hidden="true">{initialsFor(name ?? label)}</span>
    </span>
  );
}
