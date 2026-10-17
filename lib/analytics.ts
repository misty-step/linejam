'use client';

/**
 * Canonical room-cycle funnel events. PostHog is the sole client analytics
 * provider; event properties deliberately contain no room code, guest token,
 * guest id, display name, poem text, or other durable user identifier.
 */
import posthog from 'posthog-js';
import { posthogIsReady } from '@/lib/posthog/posthogReady';
import {
  JOIN_FAILURE_CODES,
  type JoinFailureCode,
} from '@/lib/analytics/joinFailure';

export type ArtifactAction = 'share' | 'save';

export type RoomCycleEventProps = {
  /** Stable one-way room key. Never pass a room code directly. */
  roomIdHash: string;
  cycle: number;
  round?: number;
  playerCount?: number;
  timeToFirstLineMs?: number;
};

type JoinEventProps = { failureCode?: JoinFailureCode };
type AnalyticsProps =
  RoomCycleEventProps | ArtifactActionProps | ShareEventProps | JoinEventProps;

export type ArtifactActionProps = RoomCycleEventProps & {
  action: ArtifactAction;
};

type ShareEventProps = {
  method: 'clipboard' | 'native-share' | 'download' | 'print';
  poemCount?: number;
};

const capturedEvents = new Set<string>();

export type PostHogCaptureClient = {
  capture: (event: string, properties?: AnalyticsProps) => void;
};

let customPostHogClient: PostHogCaptureClient | null = null;
let lastPageviewPath: string | null = null;

function safeCapture(event: string, properties?: AnalyticsProps): boolean {
  if (!posthogIsReady()) return false;
  try {
    (customPostHogClient ?? posthog).capture(event, properties);
    return true;
  } catch {
    // Analytics is best effort; never reject a successful player operation.
    return false;
  }
}

export function trackPageview() {
  const pathname = globalThis.window?.location.pathname;
  if (!pathname || pathname === lastPageviewPath) return;
  // Suspense can mount the route effect after init's loaded callback. They
  // describe the same visit, not two pageviews. A hard reload resets this.
  if (safeCapture('$pageview')) lastPageviewPath = pathname;
}

export function setPostHogClientForTests(client: PostHogCaptureClient | null) {
  customPostHogClient = client;
}

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
    'action' in properties ? properties.action : '',
  ].join(':');
  if (capturedEvents.has(key)) return;
  if (safeCapture(event, properties)) capturedEvents.add(key);
}

export { hashRoomId } from '@/lib/roomIdHash';

export function trackGameCreated(props: RoomCycleEventProps) {
  capture('game_created', props);
}

export function trackGameJoined(props: RoomCycleEventProps) {
  capture('game_joined', props);
}

export function trackJoinAttempted() {
  safeCapture('join_attempted');
}

export function trackJoinFailed(code: string) {
  const failureCode =
    JOIN_FAILURE_CODES.find((value) => value === code) ?? 'REQUEST_FAILED';
  safeCapture('join_failed', { failureCode });
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
  customPostHogClient = null;
  lastPageviewPath = null;
}

// Existing non-funnel product signals remain available to focused UI tests
// and consumers. The room-cycle report only consumes canonical events.
export function trackPoemShared(props: {
  method: 'clipboard' | 'native-share';
}) {
  safeCapture('poem_shared', { method: props.method });
}

export function trackPoemImageSaved(props: {
  method: 'native-share' | 'download';
}) {
  safeCapture('poem_image_saved', { method: props.method });
}

export function trackRecapExported(props: {
  method: 'print';
  poemCount: number;
}) {
  safeCapture('recap_exported', {
    method: props.method,
    poemCount: props.poemCount,
  });
}

export function trackRoomInviteShared(props: {
  method: 'clipboard' | 'native-share';
  roomCode: string;
}) {
  safeCapture('room_invite_shared', { method: props.method });
}
