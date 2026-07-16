export const MAX_LINE_LENGTH = 500;

/** Collapse all whitespace so stored lines satisfy the one-line contract. */
export function normalizeLineText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
