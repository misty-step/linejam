const WRITING_DRAFT_PREFIX = 'linejam:writing-draft';
const MAX_DRAFT_LENGTH = 500;

export function writingDraftKey(
  roomCode: string,
  poemId: string,
  lineIndex: number
) {
  return `${WRITING_DRAFT_PREFIX}:${roomCode}:${poemId}:${lineIndex}`;
}

function getSessionStorage(): Storage | null {
  if (globalThis.window === undefined) return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readWritingDraft(key: string): string {
  const storage = getSessionStorage();
  if (!storage) return '';

  try {
    return storage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function saveWritingDraft(key: string, value: string): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    if (value.length === 0) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, value.slice(0, MAX_DRAFT_LENGTH));
  } catch {
    // Storage can be disabled. The in-memory composer remains usable.
  }
}

export function clearWritingDraft(key: string): void {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // A committed line must not fail because browser storage is unavailable.
  }
}
