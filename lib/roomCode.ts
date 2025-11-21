/**
 * Format room code for display with spaced pairs
 * Examples:
 *   "ABCD" -> "AB CD"
 *   "ABCDEF" -> "AB CD EF"
 */
export function formatRoomCode(code: string): string {
  return code.match(/.{1,2}/g)?.join(' ') || code;
}
