import type { Emblem } from './rules.ts';

export type Presence = 'present' | 'reconnecting' | 'away';
export type Phase = 'lobby' | 'writing' | 'reading' | 'complete' | 'closed';
export type Role = 'writer' | 'spectator';
export type ReadingState = 'read' | 'reading' | 'next' | 'waiting';

export interface MemberView {
  seat: number;
  penName: string;
  emblem: Emblem;
  isHost: boolean;
  isYou: boolean;
  presence: Presence;
}

export interface WriterView {
  seat: number;
  penName: string;
  emblem: Emblem;
  isYou: boolean;
  presence: Presence;
  /** Whether this writer's line for the current round is accepted. Never the text. */
  submitted: boolean;
}

export interface AssignmentView {
  poemId: string;
  /** 0-based line index; equals the 0-based round. */
  lineIndex: number;
  words: number;
  /** Only the immediately preceding line; null in round 1. */
  previous: string | null;
  /** The stored line once accepted. */
  submitted: string | null;
}

export interface PoemLine {
  text: string;
  by: string;
}

export interface CirclePoemView {
  id: string;
  ord: number;
  readerName: string;
  readerIsYou: boolean;
  state: ReadingState;
  /** Present only after reveal. */
  lines: PoemLine[] | null;
  hearts: number;
  hearted: boolean;
}

export interface CircleView {
  poems: CirclePoemView[];
  nextPoemId: string | null;
  nextReaderName: string | null;
  /** Whether the viewer may reveal the next poem right now. */
  canReveal: boolean;
  /** Most-hearted revealed poem once the game is complete; ties by poem order; null with no hearts. */
  mostHeartedPoemId: string | null;
}

export interface GameView {
  id: string;
  cycle: number;
  status: 'writing' | 'reading' | 'complete';
  /** 0-based current round while writing; 8 afterwards. */
  round: number;
  role: Role;
  writers: WriterView[];
  assignment: AssignmentView | null;
  circle: CircleView | null;
}

export interface RoomView {
  code: string;
  version: number;
  phase: Phase;
  capacity: number;
  you: { seat: number; penName: string; emblem: Emblem; isHost: boolean };
  members: MemberView[];
  /** Why the viewer cannot start a game right now; null when they can. */
  startBlocker: 'not_host' | 'need_players' | 'game_active' | null;
  game: GameView | null;
}

export interface SubmitResult {
  poemId: string;
  lineIndex: number;
  /** The stored line. A retry or stale client settles against this text. */
  text: string;
  /** True when this call stored the line; false when it already existed. */
  created: boolean;
}

export interface ArchiveEntry {
  id: string;
  completedAt: number;
  firstLine: string;
  writers: string[];
  favorited: boolean;
  shared: boolean;
}

export interface PoemView {
  id: string;
  gameId: string;
  completedAt: number;
  lines: PoemLine[];
  hearts: number;
  favorited: boolean;
  /** True for a participant; false for a reader arriving through a share link. */
  participant: boolean;
  revealed: boolean;
  share: { active: boolean; path: string | null };
}

export interface ShareAttempt {
  token: string;
  path: string;
  /** True when the link is already public; false while it awaits confirmation. */
  active: boolean;
  expiresAt: number | null;
}

export interface FavoriteEntry {
  id: string;
  favoritedAt: number;
  /** False when the caller can no longer read the poem (share revoked); it can still be removed. */
  available: boolean;
  firstLine: string | null;
}

export interface RecapView {
  gameId: string;
  completedAt: number;
  writers: string[];
  poems: { id: string; ord: number; readerName: string; lines: PoemLine[]; hearts: number }[];
  share: { active: boolean; path: string | null };
  participant: boolean;
}
