/**
 * Convex document IDs (format v6), verified against IDs minted by the Convex
 * backend: `base32(vint(tableNumber) ++ internalId[16] ++ fletcher16)`.
 *
 * - `vint` is unsigned LEB128.
 * - The footer is Fletcher-16 with wrapping byte sums, stored `[sum1, sum2]`.
 * - Base32 packs bits most-significant first with Convex's lowercase
 *   Crockford alphabet and no padding.
 *
 * Preserving this exact format lets imported IDs, newly minted IDs and
 * `normalizeId` agree with Convex, so a snapshot can move in either direction.
 */

const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const INTERNAL_ID_LENGTH = 16;
/** Convex table numbers are unsigned 32-bit integers; an ID cannot encode more. */
export const MAX_TABLE_NUMBER = 0xffff_ffff;
const DECODE = new Map<string, number>(
  Array.from({ length: ALPHABET.length }, (_, index) => [ALPHABET.charAt(index), index]),
);

export interface DecodedId {
  readonly tableNumber: number;
  readonly internalId: Uint8Array;
}

function fletcher16(bytes: Uint8Array): [number, number] {
  let sum1 = 0;
  let sum2 = 0;
  for (const byte of bytes) {
    sum1 = (sum1 + byte) & 0xff;
    sum2 = (sum2 + sum1) & 0xff;
  }
  return [sum1, sum2];
}

function encodeBase32(bytes: Uint8Array): string {
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += ALPHABET.charAt((buffer >> bits) & 31);
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) output += ALPHABET.charAt((buffer << (5 - bits)) & 31);
  return output;
}

function decodeBase32(text: string): Uint8Array | null {
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of text) {
    const value = DECODE.get(character);
    if (value === undefined) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  // Leftover padding bits must be zero for a canonical encoding.
  if (buffer !== 0) return null;
  return Uint8Array.from(output);
}

function encodeVint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  do {
    let byte = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0);
  return bytes;
}

export function encodeId(tableNumber: number, internalId: Uint8Array): string {
  if (!Number.isSafeInteger(tableNumber) || tableNumber < 0 || tableNumber > MAX_TABLE_NUMBER) {
    throw new Error(`Invalid table number ${tableNumber}`);
  }
  if (internalId.length !== INTERNAL_ID_LENGTH) throw new Error("Invalid internal ID length");
  const body = Uint8Array.from([...encodeVint(tableNumber), ...internalId]);
  const [sum1, sum2] = fletcher16(body);
  return encodeBase32(Uint8Array.from([...body, sum1, sum2]));
}

export function decodeId(text: string): DecodedId | null {
  if (text.length < 31 || text.length > 37) return null;
  const bytes = decodeBase32(text);
  if (bytes === null || bytes.length < INTERNAL_ID_LENGTH + 3) return null;
  let tableNumber = 0;
  let multiplier = 1;
  let position = 0;
  for (;;) {
    const byte = bytes[position];
    if (byte === undefined || position >= 5) return null;
    tableNumber += (byte & 0x7f) * multiplier;
    multiplier *= 128;
    position += 1;
    if ((byte & 0x80) === 0) break;
  }
  if (bytes.length !== position + INTERNAL_ID_LENGTH + 2) return null;
  // Five vint bytes can carry more than a table number may hold.
  if (tableNumber > MAX_TABLE_NUMBER) return null;
  const body = bytes.subarray(0, bytes.length - 2);
  const [sum1, sum2] = fletcher16(body);
  if (bytes[bytes.length - 2] !== sum1 || bytes[bytes.length - 1] !== sum2) return null;
  // Reject non-canonical encodings so one ID has exactly one spelling.
  if (encodeId(tableNumber, bytes.slice(position, position + INTERNAL_ID_LENGTH)) !== text) {
    return null;
  }
  return { tableNumber, internalId: bytes.slice(position, position + INTERNAL_ID_LENGTH) };
}

export function newId(tableNumber: number): string {
  const internalId = new Uint8Array(INTERNAL_ID_LENGTH);
  crypto.getRandomValues(internalId);
  return encodeId(tableNumber, internalId);
}
