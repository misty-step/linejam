// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from 'posthog-js';
import {
  linejamPostHogConfig,
  sanitizeAnalyticsEvent,
} from '@/lib/posthog/config';

const id = '019919ab-0000-7000-8000-000000000001';
const canary = 'PRIVATE_CANARY_email@example.test_guest-token_poem-line';

function event(name = '$pageview'): CaptureResult {
  return {
    uuid: id,
    event: name,
    properties: {
      distinct_id: id,
      $device_id: id,
      $session_id: id,
      $window_id: id,
      $current_url: `https://example.test/room/SECRET?token=${canary}`,
      $referrer: canary,
      $initial_current_url: canary,
      $set: { email: canary },
      roomCode: canary,
      name: canary,
      text: canary,
      roomIdHash: '0123456789abcdef',
      cycle: 1,
      round: 3,
      action: 'save',
    },
    $set: { email: canary },
    $set_once: { $initial_referrer: canary },
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('Linejam PostHog transport privacy', () => {
  it('allows only template routes and explicit story/session properties', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_ENVIRONMENT', 'production');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'public-test-token');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_RELEASE', 'source-sha');
    window.history.replaceState(
      {},
      '',
      `/room/SECRET?email=${canary}#${canary}`
    );
    const output = sanitizeAnalyticsEvent(event('line_submitted'));
    expect(output?.properties).toMatchObject({
      token: 'public-test-token',
      app: 'linejam',
      environment: 'production',
      release: 'source-sha',
      distinct_id: id,
      $session_id: id,
      route: '/room/[code]',
      $current_url: 'https://linejam.mistystep.io/room/[code]',
      $geoip_disable: true,
      $ip: null,
      roomIdHash: '0123456789abcdef',
      cycle: 1,
      round: 3,
      action: 'save',
    });
    expect(JSON.stringify(output)).not.toContain(canary);
    expect(JSON.stringify(output)).not.toContain('SECRET');
    expect(output).not.toHaveProperty('$set');
    expect(output).not.toHaveProperty('$set_once');
  });

  it('drops unsupported events and identified account IDs', () => {
    expect(sanitizeAnalyticsEvent(null)).toBeNull();
    expect(sanitizeAnalyticsEvent(event('$identify'))).toBeNull();
    expect(sanitizeAnalyticsEvent(event('$autocapture'))).toBeNull();
    expect(sanitizeAnalyticsEvent(event('unreviewed_event'))).toBeNull();
    const identified = event();
    identified.properties.distinct_id = 'user_clerk_id';
    expect(sanitizeAnalyticsEvent(identified)).toBeNull();
  });

  it('rejects content in allowlisted property names and marks development synthetic', () => {
    window.history.replaceState({}, '', `/unknown/${canary}`);
    const input = event('artifact_action');
    input.properties.roomIdHash = canary;
    input.properties.$device_id = canary;
    input.properties.$session_id = canary;
    input.properties.action = canary;
    input.properties.method = canary;
    input.properties.cycle = canary;
    input.properties.round = -1;
    input.properties.poemCount = Number.POSITIVE_INFINITY;
    const output = sanitizeAnalyticsEvent(input);
    expect(output?.properties).toMatchObject({
      environment: 'development',
      is_synthetic: true,
      route: 'unknown-route',
    });
    expect(JSON.stringify(output)).not.toContain(canary);
    expect(output?.properties).not.toHaveProperty('roomIdHash');
    expect(output?.properties).not.toHaveProperty('round');
    expect(output?.properties).not.toHaveProperty('poemCount');
  });

  it('keeps analytics opt-out and intrusive capture disabled locally', () => {
    expect(linejamPostHogConfig).toMatchObject({
      person_profiles: 'never',
      cross_subdomain_cookie: false,
      persistence_name: 'linejam-anonymous-v1',
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      capture_exceptions: false,
      capture_performance: false,
      capture_heatmaps: false,
      respect_dnt: true,
      ip: false,
      before_send: sanitizeAnalyticsEvent,
    });
  });

  it('marks SDK-classified bots synthetic in production', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_ENVIRONMENT', 'production');
    const bot = event();
    bot.properties.$browser_type = 'bot';
    expect(sanitizeAnalyticsEvent(bot)?.properties.is_synthetic).toBe(true);
  });
});
