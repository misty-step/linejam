'use client';

/**
 * Canonical room-cycle funnel events. PostHog is the sole client analytics
 * provider; event properties deliberately contain no room code, guest token,
 * guest id, display name, poem text, or other durable user identifier.
 */
import posthog from 'posthog-js';
import { posthogIsReady } from '@/lib/posthog/posthogReady';

export type PlayerKind = 'human' | 'AI';
export type ArtifactAction = 'share' | 'save';

export type RoomCycleEventProps = {
  /** Stable one-way room key. Never pass a room code directly. */
  roomIdHash: string;
  cycle: number;
  playerKind: PlayerKind;
  round?: number;
};

export type ArtifactActionProps = RoomCycleEventProps & {
  action: ArtifactAction;
};

const capturedEvents = new Set<string>();

function capture(
  event: string,
  properties: RoomCycleEventProps | ArtifactActionProps
) {
  if (!posthogIsReady()) return;

  // Convex mutations and browser retries are idempotent. Keep the matching
  // client event idempotent too so one room/cycle/round cannot inflate a
  // conversion when a submit or navigation is retried.
  const key = [
    event,
    properties.roomIdHash,
    properties.cycle,
    properties.round ?? '',
    properties.playerKind,
    'action' in properties ? properties.action : '',
  ].join(':');
  if (capturedEvents.has(key)) return;
  capturedEvents.add(key);
  posthog.capture(event, properties);
}

export { hashRoomId } from '@/lib/roomIdHash';

export function trackGameCreated(props: RoomCycleEventProps) {
  capture('game_created', props);
}

export function trackGameJoined(props: RoomCycleEventProps) {
  capture('game_joined', props);
}

export function trackLobbyReady(props: RoomCycleEventProps) {
  capture('lobby_ready', props);
}

export function trackGameStarted(props: RoomCycleEventProps) {
  capture('game_started', props);
}

export function trackLineSubmitted(props: RoomCycleEventProps) {
  capture('line_submitted', props);
}

export function trackGameCompleted(props: RoomCycleEventProps) {
  capture('game_completed', props);
}

export function trackArtifactAction(props: ArtifactActionProps) {
  capture('artifact_action', props);
}

/** Test seam: reset only in tests; no production caller should need this. */
export function resetCapturedAnalyticsForTests() {
  capturedEvents.clear();
}

// Existing non-funnel product signals remain available to their focused UI
// tests and consumers. The room-cycle report only consumes canonical events.
export function trackAiPlayerAdded(props: { playerCount: number }) {
  if (!posthogIsReady()) return;
  posthog.capture('ai_player_added', props);
}

export function trackPoemShared(props: {
  method: 'clipboard' | 'native-share';
}) {
  if (!posthogIsReady()) return;
  posthog.capture('poem_shared', props);
}

export function trackPoemImageSaved(props: {
  method: 'native-share' | 'download';
}) {
  if (!posthogIsReady()) return;
  posthog.capture('poem_image_saved', props);
}

export function trackRecapExported(props: {
  method: 'print';
  poemCount: number;
}) {
  if (!posthogIsReady()) return;
  posthog.capture('recap_exported', props);
}

export function trackRoomInviteShared(props: {
  method: 'clipboard' | 'native-share';
  roomCode: string;
}) {
  if (!posthogIsReady()) return;
  posthog.capture('room_invite_shared', props);
}
