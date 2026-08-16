/** @vitest-environment node */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  validatePlayLinejamResult,
  writePlayLinejamResult,
} from '@/scripts/qa/write-play-linejam-result.mjs';

const schema = JSON.parse(
  readFileSync(
    path.resolve('.agents/skills/play-linejam/result.schema.json'),
    'utf8'
  )
);

const runId = '20260816T120000Z-http-localhost-3333-play';

function validResult(candidateRunId = runId) {
  return {
    runId: candidateRunId,
    target: 'http://localhost:3333',
    status: 'passed',
    startedAt: '2026-08-16T12:00:00.000Z',
    finishedAt: '2026-08-16T12:10:00.000Z',
    durationMs: 600_000,
    totalRounds: 9,
    roundsCompleted: 9,
    playerCount: 2,
    players: [
      {
        seat: 0,
        role: 'host',
        displayName: 'Host Agent',
        sessionName: `${candidateRunId}-host`,
        roundsSubmitted: 9,
        revealedPoem: true,
        status: 'passed',
        error: null,
      },
      {
        seat: 1,
        role: 'guest',
        displayName: 'Guest Player 1',
        sessionName: `${candidateRunId}-player-1`,
        roundsSubmitted: 9,
        revealedPoem: true,
        status: 'passed',
        error: null,
      },
    ],
    verification: {
      roomClosed: true,
      closedRoomJoinRejected: true,
      allSessionsCleanedUp: true,
      sessionsCleanedUp: [
        `${candidateRunId}-host`,
        `${candidateRunId}-player-1`,
        `${candidateRunId}-verifier`,
      ],
      verifierSessionName: `${candidateRunId}-verifier`,
      error: null,
    },
    evidence: {
      runDir: `.qa/runs/${candidateRunId}`,
      artifacts: [
        {
          kind: 'screenshot',
          path: `.qa/runs/${candidateRunId}/artifact-0001.webp`,
          sanitized: true,
          inspected: true,
        },
      ],
    },
    runtimeErrors: [],
    error: null,
  };
}

describe('play-linejam result validation', () => {
  it('accepts a complete passed run', () => {
    const result = validResult();
    expect(validatePlayLinejamResult(result, schema)).toBe(result);
  });

  it('rejects incomplete passed runs', () => {
    const result = validResult();
    result.roundsCompleted = 8;
    result.players[1].roundsSubmitted = 8;
    result.verification.roomClosed = false;

    expect(() => validatePlayLinejamResult(result, schema)).toThrow(
      'play-linejam result rejected'
    );
  });

  it('rejects a passed run without visual evidence', () => {
    const result = validResult();
    result.evidence.artifacts = [
      {
        kind: 'log',
        path: `.qa/runs/${result.runId}/artifact-0001.log`,
        sanitized: true,
        inspected: true,
      },
    ];

    expect(() => validatePlayLinejamResult(result, schema)).toThrow(
      'play-linejam result rejected'
    );
  });

  it('rejects mismatched players, duplicate seats, and multiple hosts', () => {
    const mismatch = validResult();
    mismatch.playerCount = 3;
    expect(() => validatePlayLinejamResult(mismatch, schema)).toThrow(
      'playerCount must equal players.length'
    );

    const duplicateSeat = validResult();
    duplicateSeat.players[1].seat = 0;
    expect(() => validatePlayLinejamResult(duplicateSeat, schema)).toThrow(
      'players[].seat must be unique'
    );

    const multipleHosts = validResult();
    multipleHosts.players[1].role = 'host';
    multipleHosts.players[1].displayName = 'Host Agent';
    expect(() => validatePlayLinejamResult(multipleHosts, schema)).toThrow(
      'play-linejam result rejected'
    );
  });

  it('rejects free-form errors and sensitive extra fields', () => {
    const rawError = {
      ...validResult(),
      status: 'failed',
      error: 'Room ABCD failed while showing a poem',
    };
    expect(() => validatePlayLinejamResult(rawError, schema)).toThrow(
      'play-linejam result rejected'
    );

    const sensitive = {
      ...validResult(),
      roomCode: 'ABCD',
    };
    expect(() => validatePlayLinejamResult(sensitive, schema)).toThrow(
      'play-linejam result rejected'
    );
  });

  it('rejects non-origin targets and foreign evidence paths', () => {
    const targetWithPath = validResult();
    targetWithPath.target = 'https://linejam.app/join?code=ABCD';
    expect(() => validatePlayLinejamResult(targetWithPath, schema)).toThrow(
      'target must be an origin without credentials, path, query, or hash'
    );

    const foreignArtifact = validResult();
    foreignArtifact.evidence.artifacts[0].path =
      '.qa/runs/20260816T120001Z-http-localhost-3333-play/artifact-0001.webp';
    expect(() => validatePlayLinejamResult(foreignArtifact, schema)).toThrow(
      'artifact path must use an opaque run-local name'
    );
  });

  it('rejects path-like run IDs and passed runs without a verifier', () => {
    const unsafeRunId = {
      ...validResult(),
      runId: '..',
    };
    expect(() => validatePlayLinejamResult(unsafeRunId, schema)).toThrow(
      'play-linejam result rejected'
    );

    const base = validResult();
    const missingVerifier = {
      ...base,
      verification: {
        ...base.verification,
        verifierSessionName: null,
        sessionsCleanedUp: base.verification.sessionsCleanedUp.slice(0, 2),
      },
    };
    expect(() => validatePlayLinejamResult(missingVerifier, schema)).toThrow(
      'play-linejam result rejected'
    );
  });

  it('rejects a room code in an artifact name before persistence', async () => {
    const candidateRunId = `20260816T120000Z-test-${randomUUID()}-play`;
    const result = validResult(candidateRunId);
    result.evidence.artifacts[0].path = `.qa/runs/${candidateRunId}/ABCD.webp`;

    await expect(
      writePlayLinejamResult(JSON.stringify(result))
    ).rejects.toThrow('play-linejam result rejected');
    expect(
      existsSync(path.resolve(`.qa/runs/${candidateRunId}/result.json`))
    ).toBe(false);
  });

  it('rejects a missing artifact before persistence', async () => {
    const candidateRunId = `20260816T120000Z-test-${randomUUID()}-play`;
    const result = validResult(candidateRunId);
    const runsDir = path.resolve('.qa/runs');
    const runDir = path.resolve(result.evidence.runDir);
    mkdirSync(runsDir, { recursive: true });
    mkdirSync(runDir);

    try {
      await expect(
        writePlayLinejamResult(JSON.stringify(result))
      ).rejects.toThrow('artifact file is missing');
      expect(existsSync(path.resolve(runDir, 'result.json'))).toBe(false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('allows failed runs only with fixed error codes', () => {
    const base = validResult();
    const result = {
      ...base,
      status: 'failed',
      roundsCompleted: 4,
      players: [
        {
          ...base.players[0],
          roundsSubmitted: 4,
          revealedPoem: false,
          status: 'failed',
          error: 'semantic_wait_expired',
        },
        base.players[1],
      ],
      verification: {
        ...base.verification,
        roomClosed: false,
        closedRoomJoinRejected: false,
        error: 'room_closure_failed',
      },
      runtimeErrors: ['semantic_wait_expired'],
      error: 'room_closure_failed',
    };

    expect(validatePlayLinejamResult(result, schema)).toBe(result);
  });
  it('rejects malformed candidates without echoing their contents', async () => {
    const secret = 'do-not-echo-this-value';
    await expect(
      writePlayLinejamResult(`{"error":"${secret}"`)
    ).rejects.toThrow('candidate is not valid JSON');

    try {
      await writePlayLinejamResult(`{"error":"${secret}"`);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
