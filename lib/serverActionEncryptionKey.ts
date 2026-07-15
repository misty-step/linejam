export function isValidServerActionEncryptionKey(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return false;

  try {
    return Buffer.from(normalized, 'base64').byteLength === 32;
  } catch {
    return false;
  }
}
