'use client';

/**
 * Lightweight analytics tracking for key user actions.
 *
 * Uses Vercel Analytics track() for funnel metrics:
 * - game_created, game_joined, game_started, game_completed
 * - poem_shared, ai_player_added
 *
 * @see https://vercel.com/docs/analytics/custom-events
 */

import { track } from '@vercel/analytics';

type GameCreatedProps = {
  playerCount?: number;
};

type GameJoinedProps = {
  roomCode: string;
};

type GameStartedProps = {
  playerCount: number;
  hasAi: boolean;
};

type GameCompletedProps = {
  playerCount: number;
  poemCount: number;
  hasAi: boolean;
};

type PoemSharedProps = {
  method: 'clipboard';
};

type AiPlayerAddedProps = {
  playerCount: number;
};

/**
 * Track game creation by host.
 */
export function trackGameCreated(props?: GameCreatedProps) {
  track('game_created', props ?? {});
}

/**
 * Track player joining a room.
 */
export function trackGameJoined(props: GameJoinedProps) {
  track('game_joined', props);
}

/**
 * Track game start (host clicks Start).
 */
export function trackGameStarted(props: GameStartedProps) {
  track('game_started', props);
}

/**
 * Track game completion (all poems revealed).
 */
export function trackGameCompleted(props: GameCompletedProps) {
  track('game_completed', props);
}

/**
 * Track poem shared via clipboard.
 */
export function trackPoemShared(props: PoemSharedProps) {
  track('poem_shared', props);
}

/**
 * Track AI player added to room.
 */
export function trackAiPlayerAdded(props: AiPlayerAddedProps) {
  track('ai_player_added', props);
}
