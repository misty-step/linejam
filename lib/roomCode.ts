/**
 * Format room code for display with spaced pairs
 * Examples:
 *   "ABCD" -> "AB CD"
 *   "ABCDEF" -> "AB CD EF"
 */
export function formatRoomCode(code: string): string {
  return code.match(/.{1,2}/g)?.join(' ') || code;
}

/**
 * Normalize a typed or pasted room code: uppercase, separators stripped,
 * at most 4 characters (PRODUCT.md [L1-2.6]).
 */
export function normalizeRoomCodeInput(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
}
