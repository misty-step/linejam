const WRITING_DRAFT_PREFIX = 'linejam:writing-draft';
const MAX_DRAFT_LENGTH = 500;
let draftOwner: string | null = null;
let fallbackDrafts: Map<string, string> | null = null;

/** Volatile drafts belong to one verified principal, never its successor. */
export function setWritingDraftOwner(owner: string | null): void {
  if (owner === draftOwner) return;
  draftOwner = owner;
  fallbackDrafts = null;
}

function rememberFallbackDraft(
  key: string,
  value: string,
  owner: string | null
): void {
  if (owner === null || owner !== draftOwner) return;
  fallbackDrafts ??= new Map();
  fallbackDrafts.set(key, value);
}

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

export function readWritingDraft(key: string, owner: string | null): string {
  if (owner === null || (draftOwner !== null && owner !== draftOwner)) {
    return '';
  }
  const fallback = fallbackDrafts?.get(key);
  if (fallback !== undefined) return fallback;
  const storage = getSessionStorage();
  if (!storage) return '';

  try {
    return storage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function saveWritingDraft(
  key: string,
  value: string,
  owner: string | null
): void {
  if (owner === null || (draftOwner !== null && owner !== draftOwner)) return;
  const draft = value.slice(0, MAX_DRAFT_LENGTH);
  const storage = getSessionStorage();
  if (!storage) {
    rememberFallbackDraft(key, draft, owner);
    return;
  }

  try {
    if (draft.length === 0) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, draft);
    }
    fallbackDrafts?.delete(key);
  } catch {
    rememberFallbackDraft(key, draft, owner);
  }
}

export function clearWritingDraft(key: string, owner: string | null): void {
  saveWritingDraft(key, '', owner);
}
