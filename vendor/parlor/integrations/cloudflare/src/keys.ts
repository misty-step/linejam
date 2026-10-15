import type { Value } from "convex/values";

/**
 * Order-preserving, prefix-free byte encoding of Convex values. Comparing two
 * encoded keys bytewise gives the same order as `compareValues` from
 * `convex/values` (undefined < null < bigint < number < boolean < string <
 * bytes < array < object, strings in UTF-8 order). Keys are stored as
 * lowercase hex so SQLite's default BINARY collation preserves that order.
 */

const TAG = {
  undefined: 0x01,
  null: 0x02,
  bigint: 0x03,
  number: 0x04,
  false: 0x05,
  true: 0x06,
  string: 0x07,
  bytes: 0x08,
  array: 0x09,
  object: 0x0a,
} as const;

const textEncoder = new TextEncoder();

const SIGN_BIT = 0x8000_0000_0000_0000n;
const ALL_BITS = 0xffff_ffff_ffff_ffffn;
/** The smallest negative NaN bit pattern: sign set, exponent all ones, payload 1. */
const FIRST_NEGATIVE_NAN = 0xfff0_0000_0000_0001n;

/**
 * Map a float's IEEE-754 bits to an unsigned integer that sorts like
 * `compareValues`: negative NaNs < -Infinity < ... < -0 < +0 < ... <
 * +Infinity < positive NaNs. `compareValues` orders NaNs of one sign by
 * their signed bits, which ascend with the payload, so negative NaNs keep
 * their payload order instead of being complemented like negative numbers.
 */
function orderedFloatBits(bits: bigint): bigint {
  if ((bits & SIGN_BIT) === 0n) return bits | SIGN_BIT;
  if (bits >= FIRST_NEGATIVE_NAN) return bits - FIRST_NEGATIVE_NAN;
  return ~bits & ALL_BITS;
}

/**
 * Escape `0x00` as `0x00 0xff` and terminate with `0x00 0x00`, so the encoding
 * of a string or byte value is never a prefix of another one. That keeps
 * `prefixEnd(encodeKey([value]))` from also matching longer values.
 */
function pushEscaped(out: number[], bytes: Uint8Array) {
  for (const byte of bytes) {
    out.push(byte);
    if (byte === 0x00) out.push(0xff);
  }
  out.push(0x00, 0x00);
}

function pushValue(out: number[], value: Value | undefined) {
  if (value === undefined) {
    out.push(TAG.undefined);
  } else if (value === null) {
    out.push(TAG.null);
  } else if (typeof value === "bigint") {
    out.push(TAG.bigint);
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, BigInt.asUintN(64, value) ^ 0x8000_0000_0000_0000n);
    out.push(...new Uint8Array(view.buffer));
  } else if (typeof value === "number") {
    out.push(TAG.number);
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    view.setBigUint64(0, orderedFloatBits(view.getBigUint64(0)));
    out.push(...new Uint8Array(view.buffer));
  } else if (typeof value === "boolean") {
    out.push(value ? TAG.true : TAG.false);
  } else if (typeof value === "string") {
    out.push(TAG.string);
    pushEscaped(out, textEncoder.encode(value));
  } else if (value instanceof ArrayBuffer) {
    out.push(TAG.bytes);
    pushEscaped(out, new Uint8Array(value));
  } else if (Array.isArray(value)) {
    out.push(TAG.array);
    for (const element of value) pushValue(out, element);
    out.push(0x00);
  } else {
    out.push(TAG.object);
    const record = value as Record<string, Value | undefined>;
    // `compareValues` orders fields with the default sort, then compares pairs.
    for (const key of Object.keys(record).sort()) {
      pushValue(out, key);
      pushValue(out, record[key]);
    }
    out.push(0x00);
  }
}

function toHex(bytes: readonly number[]): string {
  let text = "";
  for (const byte of bytes) text += byte.toString(16).padStart(2, "0");
  return text;
}

/** Encode a tuple of index field values as an ordered hex key. */
export function encodeKey(values: readonly (Value | undefined)[]): string {
  const out: number[] = [];
  for (const value of values) pushValue(out, value);
  return toHex(out);
}

/**
 * Encode one value; a key is the concatenation of its fields' encodings.
 * Build keys from fields with this rather than `encodeKey([...])`: V8 may
 * canonicalize a NaN's sign and payload when it stores the number in an
 * array of doubles, and `compareValues` orders NaNs by those bits.
 */
export function encodeValue(value: Value | undefined): string {
  const out: number[] = [];
  pushValue(out, value);
  return toHex(out);
}

/**
 * Smallest key greater than every key that starts with `prefix`, or null when
 * no such key exists. Used for exclusive bounds over a key prefix.
 */
export function prefixEnd(prefix: string): string | null {
  const bytes: number[] = [];
  for (let index = 0; index < prefix.length; index += 2) {
    bytes.push(Number.parseInt(prefix.slice(index, index + 2), 16));
  }
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    const byte = bytes[index] ?? 0xff;
    if (byte < 0xff) {
      return toHex([...bytes.slice(0, index), byte + 1]);
    }
  }
  return null;
}

/** The immediate successor of a complete key (keys are prefix-free). */
export function keySuccessor(key: string): string {
  return `${key}00`;
}
