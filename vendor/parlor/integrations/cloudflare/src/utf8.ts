/**
 * Bytes `text` takes as UTF-8, exactly as `TextEncoder` encodes it (a lone
 * surrogate becomes the 3-byte U+FFFD), without allocating the encoding.
 */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && isLowSurrogate(text.charCodeAt(index + 1))) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** Whether `text` is longer than `limit` UTF-8 bytes; cheap for clear cases. */
export function exceedsUtf8Bytes(text: string, limit: number): boolean {
  // Every UTF-16 code unit takes one to three UTF-8 bytes.
  if (text.length > limit) return true;
  if (text.length * 3 <= limit) return false;
  return utf8Length(text) > limit;
}
