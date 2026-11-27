import type { Emblem } from '../../shared/rules.ts';
import type { ArchiveEntry, PoemView, RecapView, RoomView } from '../../shared/types.ts';
import type { Link } from './net.ts';

export type Route =
  | { name: 'landing'; code: string }
  | { name: 'room'; code: string }
  | { name: 'poems' }
  | { name: 'poem'; id: string; share: string | null }
  | { name: 'recap'; id: string; share: string | null }
  | { name: 'account' }
  | { name: 'notfound' };

export type Theme = 'system' | 'light' | 'dark';
type Loaded<T> = { status: 'loading' | 'ready' | 'missing' | 'error'; view: T | null };

export interface State {
  route: Route;
  guest: { status: 'checking' | 'ready' | 'none' | 'invalid' | 'offline'; guestId: string | null };
  theme: Theme;
  muted: boolean;
  menuOpen: boolean;

  penName: string;
  emblem: Emblem;
  entryBusy: 'create' | 'join' | null;
  errors: { penName?: string; code?: string };

  room: RoomView | null;
  roomError: string | null;
  roomGone: 'closed' | null;
  link: Link;
  draft: string;
  tally: number;
  lineError: string | null;
  selectedPoem: string | null;
  /** Share status per poem id, or `recap:<gameId>`. Undefined until loaded. */
  shares: Record<string, { active: boolean; path: string | null } | undefined>;

  archive: { status: 'loading' | 'ready' | 'error'; entries: ArchiveEntry[] };
  poem: Loaded<PoemView>;
  recap: Loaded<RecapView>;

  busy: Record<string, boolean>;
  flash: Record<string, { text: string; kind: 'ok' | 'error' } | undefined>;
  nudge: string | null;
}
