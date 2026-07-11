'use client';

/**
 * Lightweight analytics tracking for key user actions.
 *
 * Uses the initialized PostHog client for privacy-safe funnel metrics:
 * - game_created, game_joined, game_started, game_completed
 * - poem_shared, ai_player_added
 * - poem_image_saved, recap_exported (linejam-943: the keepable-artifact
 *   funnel — measures save/export usage so the print-on-demand stretch
 *   decision has real demand data behind it)
 *
 */

import posthog from 'posthog-js';
import { posthogIsReady } from '@/lib/posthog/posthogReady';

function capture(event: string, properties: Record<string, unknown> = {}) {
  if (!posthogIsReady()) return;
  posthog.capture(event, properties);
}

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
  method: 'clipboard' | 'native-share';
};

type RoomInviteSharedProps = {
  method: 'clipboard' | 'native-share';
  roomCode: string;
};

type AiPlayerAddedProps = {
  playerCount: number;
};

type PoemImageSavedProps = {
  method: 'native-share' | 'download';
};

type RecapExportedProps = {
  method: 'print';
  poemCount: number;
};

/**
 * Track game creation by host.
 */
export function trackGameCreated(props?: GameCreatedProps) {
  capture('game_created', props ?? {});
}

/**
 * Track player joining a room.
 */
export function trackGameJoined(props: GameJoinedProps) {
  capture('game_joined', props);
}

/**
 * Track game start (host clicks Start).
 */
export function trackGameStarted(props: GameStartedProps) {
  capture('game_started', props);
}

/**
 * Track game completion (all poems revealed).
 */
export function trackGameCompleted(props: GameCompletedProps) {
  capture('game_completed', props);
}

/**
 * Track poem shared via clipboard.
 */
export function trackPoemShared(props: PoemSharedProps) {
  capture('poem_shared', props);
}

/**
 * Track room invite sharing from the in-room chrome.
 */
export function trackRoomInviteShared(props: RoomInviteSharedProps) {
  capture('room_invite_shared', props);
}

/**
 * Track AI player added to room.
 */
export function trackAiPlayerAdded(props: AiPlayerAddedProps) {
  capture('ai_player_added', props);
}

/**
 * Track a poem's themed card image being saved (native share sheet or
 * direct download) from the reveal or poem archive page.
 */
export function trackPoemImageSaved(props: PoemImageSavedProps) {
  capture('poem_image_saved', props);
}

/**
 * Track a session recap export (currently: print-to-PDF via the browser's
 * native print dialog, triggered from the recap page's Export action).
 */
export function trackRecapExported(props: RecapExportedProps) {
  capture('recap_exported', props);
}
