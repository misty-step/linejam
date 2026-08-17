/** @vitest-environment node */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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
const schemaWithoutPassedConditional = structuredClone(schema);
delete schemaWithoutPassedConditional.allOf;

const runId =
  '20260816T120000Z-http-localhost-3333-00112233445566778899aabbccddeeff-play';

function uniqueRunId() {
  return `20260816T120000Z-test-${randomUUID().replaceAll('-', '')}-play`;
}

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

  it('enforces passed-run invariants independently of schema conditionals', () => {
    const verifierBase = validResult();
    const missingVerifier = {
      ...verifierBase,
      verification: {
        ...verifierBase.verification,
        verifierSessionName: null,
      },
    };
    expect(() =>
      validatePlayLinejamResult(missingVerifier, schemaWithoutPassedConditional)
    ).toThrow('passed run requires a fresh verifier session');

    const incompleteRounds = validResult();
    incompleteRounds.roundsCompleted = 8;
    expect(() =>
      validatePlayLinejamResult(
        incompleteRounds,
        schemaWithoutPassedConditional
      )
    ).toThrow('passed run must complete 9 rounds');

    const incompletePlayer = validResult();
    incompletePlayer.players[0].roundsSubmitted = 8;
    expect(() =>
      validatePlayLinejamResult(
        incompletePlayer,
        schemaWithoutPassedConditional
      )
    ).toThrow('passed run requires 9 submissions from every player');

    const unrevealedPlayer = validResult();
    unrevealedPlayer.players[0].revealedPoem = false;
    expect(() =>
      validatePlayLinejamResult(
        unrevealedPlayer,
        schemaWithoutPassedConditional
      )
    ).toThrow('passed run requires every player to complete reveal');

    const failedPlayer = validResult();
    failedPlayer.players[0].status = 'failed';
    expect(() =>
      validatePlayLinejamResult(failedPlayer, schemaWithoutPassedConditional)
    ).toThrow('passed run requires every player status to be passed');

    const incompleteClosure = validResult();
    incompleteClosure.verification.roomClosed = false;
    expect(() =>
      validatePlayLinejamResult(
        incompleteClosure,
        schemaWithoutPassedConditional
      )
    ).toThrow(
      'passed run requires closure, join rejection, and session cleanup'
    );

    const runtimeFailure = {
      ...validResult(),
      runtimeErrors: ['interaction_failed'],
    };
    expect(() =>
      validatePlayLinejamResult(runtimeFailure, schemaWithoutPassedConditional)
    ).toThrow('passed run cannot contain runtime or aggregate errors');

    const aggregateFailure = {
      ...validResult(),
      error: 'unknown_failure',
    };
    expect(() =>
      validatePlayLinejamResult(
        aggregateFailure,
        schemaWithoutPassedConditional
      )
    ).toThrow('passed run cannot contain runtime or aggregate errors');
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
      '.qa/runs/20260816T120001Z-http-localhost-3333-00112233445566778899aabbccddeeff-play/artifact-0001.webp';
    expect(() => validatePlayLinejamResult(foreignArtifact, schema)).toThrow(
      'artifact path must use an opaque run-local name'
    );
  });

  it('rejects invalid target, artifact, and session relationships', () => {
    const nonHttpTarget = validResult();
    nonHttpTarget.target = 'ftp://linejam.app';
    expect(() => validatePlayLinejamResult(nonHttpTarget, schema)).toThrow(
      'target must use http or https'
    );

    const nonCanonicalTarget = validResult();
    nonCanonicalTarget.target = 'https://linejam.app:443';
    expect(() => validatePlayLinejamResult(nonCanonicalTarget, schema)).toThrow(
      'target must use its canonical origin form'
    );

    const mismatchedRunDir = validResult();
    mismatchedRunDir.evidence.runDir =
      '.qa/runs/20260816T120001Z-http-localhost-3333-00112233445566778899aabbccddeeff-play';
    expect(() => validatePlayLinejamResult(mismatchedRunDir, schema)).toThrow(
      'evidence.runDir must equal'
    );

    const mismatchedArtifactKind = validResult();
    mismatchedArtifactKind.evidence.artifacts[0].kind = 'video';
    expect(() =>
      validatePlayLinejamResult(mismatchedArtifactKind, schema)
    ).toThrow('artifact path must use an opaque run-local name');

    const noncontiguousSeats = validResult();
    noncontiguousSeats.players[1].seat = 2;
    noncontiguousSeats.players[1].sessionName = `${noncontiguousSeats.runId}-player-2`;
    noncontiguousSeats.verification.sessionsCleanedUp[1] = `${noncontiguousSeats.runId}-player-2`;
    expect(() => validatePlayLinejamResult(noncontiguousSeats, schema)).toThrow(
      'player seats must be contiguous from zero'
    );

    const mismatchedPlayerSession = validResult();
    mismatchedPlayerSession.players[1].sessionName = `${mismatchedPlayerSession.runId}-player-2`;
    expect(() =>
      validatePlayLinejamResult(mismatchedPlayerSession, schema)
    ).toThrow('player sessionName must equal');

    const mismatchedVerifier = validResult();
    mismatchedVerifier.verification.verifierSessionName = `${mismatchedVerifier.runId}-verifier-extra`;
    mismatchedVerifier.verification.sessionsCleanedUp[2] = `${mismatchedVerifier.runId}-verifier-extra`;
    expect(() => validatePlayLinejamResult(mismatchedVerifier, schema)).toThrow(
      'verification.verifierSessionName must belong to the run'
    );

    const foreignCleanupSession = validResult();
    foreignCleanupSession.verification.sessionsCleanedUp[0] =
      'foreign-run-host';
    expect(() =>
      validatePlayLinejamResult(foreignCleanupSession, schema)
    ).toThrow('every cleaned session must belong to the run');

    const incompleteCleanup = validResult();
    incompleteCleanup.verification.sessionsCleanedUp.pop();
    expect(() => validatePlayLinejamResult(incompleteCleanup, schema)).toThrow(
      'cleaned sessions must include'
    );
  });

  it('rejects path-like or entropy-free run IDs and missing verifiers', () => {
    const unsafeRunId = {
      ...validResult(),
      runId: '..',
    };
    expect(() => validatePlayLinejamResult(unsafeRunId, schema)).toThrow(
      'play-linejam result rejected'
    );
    const entropyFreeRunId = {
      ...validResult(),
      runId: '20260816T120000Z-http-localhost-3333-play',
    };
    expect(() => validatePlayLinejamResult(entropyFreeRunId, schema)).toThrow(
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
    const candidateRunId = uniqueRunId();
    const result = validResult(candidateRunId);
    result.evidence.artifacts[0].path = `.qa/runs/${candidateRunId}/ABCD.webp`;

    await expect(
      writePlayLinejamResult(JSON.stringify(result))
    ).rejects.toThrow('play-linejam result rejected');
    expect(
      existsSync(path.resolve(`.qa/runs/${candidateRunId}/result.json`))
    ).toBe(false);
  });

  it('persists a passed receipt backed by a physical visual artifact', async () => {
    const candidateRunId = uniqueRunId();
    const result = validResult(candidateRunId);
    const runsDir = path.resolve('.qa/runs');
    const runDir = path.resolve(result.evidence.runDir);
    result.evidence.artifacts[0].path = `.qa/runs/${candidateRunId}/artifact-0001.png`;
    mkdirSync(runsDir, { recursive: true });
    mkdirSync(runDir);
    writeFileSync(
      path.resolve(runDir, 'artifact-0001.png'),
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',
        'base64'
      )
    );

    try {
      const outputPath = await writePlayLinejamResult(JSON.stringify(result));
      expect(outputPath).toBe(path.resolve(runDir, 'result.json'));
      expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(result);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('rejects an empty artifact before persistence', async () => {
    const candidateRunId = uniqueRunId();
    const result = validResult(candidateRunId);
    const runsDir = path.resolve('.qa/runs');
    const runDir = path.resolve(result.evidence.runDir);
    mkdirSync(runsDir, { recursive: true });
    mkdirSync(runDir);
    writeFileSync(path.resolve(runDir, 'artifact-0001.webp'), '');

    try {
      await expect(
        writePlayLinejamResult(JSON.stringify(result))
      ).rejects.toThrow('artifact must be a non-empty regular run-local file');
      expect(existsSync(path.resolve(runDir, 'result.json'))).toBe(false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('rejects a symlinked artifact before persistence', async () => {
    const candidateRunId = uniqueRunId();
    const result = validResult(candidateRunId);
    const runsDir = path.resolve('.qa/runs');
    const runDir = path.resolve(result.evidence.runDir);
    mkdirSync(runsDir, { recursive: true });
    mkdirSync(runDir);
    writeFileSync(path.resolve(runDir, 'target.webp'), 'not retained');
    symlinkSync('target.webp', path.resolve(runDir, 'artifact-0001.webp'));

    try {
      await expect(
        writePlayLinejamResult(JSON.stringify(result))
      ).rejects.toThrow('artifact must be a non-empty regular run-local file');
      expect(existsSync(path.resolve(runDir, 'result.json'))).toBe(false);
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('rejects a non-directory artifact run path', async () => {
    const candidateRunId = uniqueRunId();
    const result = validResult(candidateRunId);
    const runsDir = path.resolve('.qa/runs');
    const runDir = path.resolve(result.evidence.runDir);
    mkdirSync(runsDir, { recursive: true });
    writeFileSync(runDir, 'not a directory');

    try {
      await expect(
        writePlayLinejamResult(JSON.stringify(result))
      ).rejects.toThrow('artifact run directory must be a regular directory');
    } finally {
      rmSync(runDir, { force: true });
    }
  });

  it('rejects a missing artifact run directory without creating it', async () => {
    const candidateRunId = uniqueRunId();
    const result = validResult(candidateRunId);
    const runDir = path.resolve(result.evidence.runDir);

    await expect(
      writePlayLinejamResult(JSON.stringify(result))
    ).rejects.toThrow('artifact run directory is missing');
    expect(existsSync(runDir)).toBe(false);
  });

  it('rejects a missing artifact before persistence', async () => {
    const candidateRunId = uniqueRunId();
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
