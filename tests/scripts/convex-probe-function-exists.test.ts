/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import {
  parseFunctionIdentifiers,
  probeFunctionExists,
  runFunctionSpec,
} from '@/scripts/convex/probe-function-exists.mjs';

// Shape matches a live `convex function-spec` response (fields trimmed).
const SAMPLE_SPEC = JSON.stringify({
  url: 'https://exuberant-bloodhound-885.convex.cloud',
  functions: [
    { functionType: 'Mutation', identifier: 'rooms.js:createRoom' },
    {
      functionType: 'Mutation',
      identifier: 'guestSessions.js:checkGuestSessionThrottle',
    },
    {
      functionType: 'Mutation',
      identifier: 'migrations.js:dropLegacyModeColumns',
    },
  ],
});

describe('parseFunctionIdentifiers', () => {
  it('extracts function identifiers from a function-spec payload', () => {
    expect(parseFunctionIdentifiers(SAMPLE_SPEC)).toEqual(
      new Set([
        'rooms.js:createRoom',
        'guestSessions.js:checkGuestSessionThrottle',
        'migrations.js:dropLegacyModeColumns',
      ])
    );
  });

  it('tolerates a spec with no functions', () => {
    expect(parseFunctionIdentifiers(JSON.stringify({ url: 'x' }))).toEqual(
      new Set()
    );
  });
});

describe('runFunctionSpec', () => {
  it('returns stdout on a successful probe', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: SAMPLE_SPEC,
      stderr: '',
    });

    expect(runFunctionSpec({}, runner)).toBe(SAMPLE_SPEC);
    expect(runner).toHaveBeenCalledWith(
      'pnpm',
      ['exec', 'convex', 'function-spec'],
      { env: {}, encoding: 'utf8' }
    );
  });

  it('surfaces the exact CLI failure instead of swallowing it', () => {
    const runner = vi.fn().mockReturnValue({
      status: 1,
      stdout: '',
      stderr:
        'MissingAccessToken: An access token is required for this command.',
    });

    expect(() => runFunctionSpec({}, runner)).toThrow(/MissingAccessToken/);
  });
});

describe('probeFunctionExists', () => {
  it('reports true for a function present in the spec', () => {
    const runner = vi
      .fn()
      .mockReturnValue({ status: 0, stdout: SAMPLE_SPEC, stderr: '' });

    expect(
      probeFunctionExists(
        'guestSessions.js:checkGuestSessionThrottle',
        {},
        runner
      )
    ).toBe(true);
  });

  it('reports false for a function absent from the spec', () => {
    const runner = vi
      .fn()
      .mockReturnValue({ status: 0, stdout: SAMPLE_SPEC, stderr: '' });

    expect(probeFunctionExists('rooms.js:deleteRoom', {}, runner)).toBe(false);
  });
});
