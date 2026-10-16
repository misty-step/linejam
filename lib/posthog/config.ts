import type { BeforeSendFn, PostHogConfig } from 'posthog-js';
import { safeTransactionName } from '@/lib/sentryPrivacy';

const allowedEvents = new Set([
  '$pageview',
  'game_created',
  'game_joined',
  'lobby_ready',
  'game_started',
  'line_submitted',
  'game_completed',
  'artifact_action',
  'poem_shared',
  'poem_image_saved',
  'recap_exported',
  'room_invite_shared',
]);
const anonymousId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Final transport boundary: never forward SDK enrichment or arbitrary props. */
export const sanitizeAnalyticsEvent: BeforeSendFn = (event) => {
  if (!event || !allowedEvents.has(event.event)) return null;
  const input = event.properties;
  if (!anonymousId.test(input.distinct_id ?? '')) return null;
  const route = safeTransactionName(window.location.pathname);
  const production =
    process.env.NEXT_PUBLIC_POSTHOG_ENVIRONMENT === 'production';
  const properties: typeof input = {
    // posthog-js carries its write-only transport token inside properties.
    token: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    app: 'linejam',
    environment: production ? 'production' : 'development',
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? 'unknown',
    // Bounded release probes can opt into exclusion even when the SDK's bot
    // filter requires a normal browser fingerprint to verify real ingestion.
    is_synthetic:
      !production ||
      navigator.webdriver === true ||
      sessionStorage.getItem('linejam-analytics-synthetic') === '1',
    distinct_id: input.distinct_id,
    $process_person_profile: false,
    $geoip_disable: true,
    $ip: null,
    route,
    $host: 'linejam.mistystep.io',
    $pathname: route,
    $current_url: `https://linejam.mistystep.io${route}`,
  };
  for (const key of ['$device_id', '$session_id', '$window_id']) {
    if (anonymousId.test(input[key] ?? '')) properties[key] = input[key];
  }
  if (/^[0-9a-f]{16}$/.test(input.roomIdHash ?? '')) {
    properties.roomIdHash = input.roomIdHash;
  }
  for (const key of ['cycle', 'round', 'poemCount']) {
    if (Number.isSafeInteger(input[key]) && input[key] >= 0) {
      properties[key] = input[key];
    }
  }
  if (input.action === 'save' || input.action === 'share') {
    properties.action = input.action;
  }
  if (
    ['clipboard', 'native-share', 'download', 'print'].includes(input.method)
  ) {
    properties.method = input.method;
  }
  // Reconstruct the envelope too: $set/$set_once can contain SDK referrer data.
  return {
    uuid: event.uuid,
    event: event.event,
    timestamp: event.timestamp,
    properties,
  };
};

export const linejamPostHogConfig: Partial<PostHogConfig> = {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
  ui_host: 'https://us.posthog.com',
  person_profiles: 'never',
  persistence_name: 'linejam-anonymous-v1',
  cross_subdomain_cookie: false,
  cookie_expiration: 30,
  capture_pageview: false,
  capture_pageleave: false,
  autocapture: false,
  rageclick: false,
  capture_dead_clicks: false,
  capture_exceptions: false,
  capture_performance: false,
  capture_heatmaps: false,
  disable_session_recording: true,
  disable_surveys: true,
  advanced_disable_flags: true,
  advanced_disable_toolbar_metrics: true,
  save_referrer: false,
  store_google: false,
  ip: false,
  respect_dnt: true,
  before_send: sanitizeAnalyticsEvent,
};
