/**
 * Shared route predicates so chrome-visibility logic lives in one place.
 *
 * A "game route" is a live room (Lobby → Writing → Reveal). Both the Header and
 * the Footer hide their marketing chrome there so the play surface is a focus
 * space — keep the rule here so the two never drift.
 */
export function isGameRoute(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/room/'));
}
