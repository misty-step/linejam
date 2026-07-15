const WRITING_DRAFT_PREFIX = 'linejam:writing-draft';
const MAX_DRAFT_LENGTH = 500;

export function writingDraftKey(
  roomCode: string,
  poemId: string,
  lineIndex: number
) {
  return `${WRITING_DRAFT_PREFIX}:${roomCode}:${poemId}:${lineIndex}`;
}

export function readWritingDraft(key: string) {
  if (typeof window === 'undefined') return '';

  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function saveWritingDraft(key: string, value: string) {
  if (typeof window === 'undefined') return;

  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, value.slice(0, MAX_DRAFT_LENGTH));
  } catch {
    // Storage can be disabled. The in-memory composer remains usable.
  }
}

export function clearWritingDraft(key: string) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // A committed line must not fail because browser storage is unavailable.
  }
}
