import { describe, expect, it } from 'vitest';
import {
  sentryAutomationProvenanceMessage,
  sentryAutomationGroupMessage,
  signSentryAutomationGroup,
  signSentryAutomationProvenance,
  verifySentryAutomationProvenance,
} from '@/sentry.provenance.mjs';

const SECRET = 'provenance-test-secret-with-at-least-32-bytes';
const FIELDS = {
  eventId: '0123456789abcdef0123456789abcdef',
  runtime: 'github-actions',
  environment: 'production',
  release: 'a'.repeat(40),
  level: 'error',
  operation: 'productionSmoke',
  failureCode: 'unexpected_error',
};

describe('Sentry automation provenance', () => {
  it('signs and verifies the exact event identity and closed routing fields', async () => {
    const signature = await signSentryAutomationProvenance(SECRET, FIELDS);

    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    await expect(
      verifySentryAutomationProvenance(SECRET, FIELDS, signature)
    ).resolves.toBe(true);
    await expect(
      verifySentryAutomationProvenance(
        SECRET,
        { ...FIELDS, eventId: 'f'.repeat(32) },
        signature
      )
    ).resolves.toBe(false);
    await expect(
      verifySentryAutomationProvenance(
        SECRET,
        { ...FIELDS, operation: 'previewSmoke' },
        signature
      )
    ).resolves.toBe(false);
  });

  it('derives a stable secret grouping key from closed routing fields', async () => {
    const routing = {
      runtime: FIELDS.runtime,
      environment: FIELDS.environment,
      level: FIELDS.level,
      operation: FIELDS.operation,
      failureCode: FIELDS.failureCode,
    };
    const key = await signSentryAutomationGroup(SECRET, routing);

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    await expect(signSentryAutomationGroup(SECRET, routing)).resolves.toBe(key);
    await expect(
      signSentryAutomationGroup(SECRET, {
        ...routing,
        operation: 'previewSmoke',
      })
    ).resolves.not.toBe(key);
    expect(() =>
      sentryAutomationGroupMessage({ ...routing, operation: 'bad\noperation' })
    ).toThrow('Invalid Sentry automation group field');
  });

  it('rejects malformed identities, signatures, and weak secrets', async () => {
    expect(() =>
      sentryAutomationProvenanceMessage({ ...FIELDS, eventId: '../event' })
    ).toThrow('Invalid Sentry provenance event ID');
    await expect(
      verifySentryAutomationProvenance(SECRET, FIELDS, 'not-a-signature')
    ).resolves.toBe(false);
    await expect(
      signSentryAutomationProvenance('too-short', FIELDS)
    ).rejects.toThrow('must be 32-256 bytes');
  });
});
