/** Deterministic, non-identifying key used for analytics correlation. */
export function hashRoomId(roomId: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < roomId.length; i++) {
    const code = roomId.charCodeAt(i);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + i), 0x85ebca6b);
  }
  return [first >>> 0, second >>> 0]
    .map((part) => part.toString(16).padStart(8, '0'))
    .join('');
}
