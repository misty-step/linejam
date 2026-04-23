/** @vitest-environment node */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { afterEach } from 'vitest';

import {
  DEFAULT_AGENTIC_MISSION,
  assertAgenticMissionEnvironment,
  createAgenticRunId,
  listAgenticMissions,
  normalizeAgenticTarget,
  resolveAgenticBaseUrl,
  resolveAgenticMission,
} from '@/qa/agentic/missions.mjs';
import {
  createAgenticManifest,
  detectGenericErrors,
  markAgenticManifestFinished,
  validateAgenticManifest,
} from '@/qa/agentic/manifest.mjs';
import {
  assertStagehandModelEnvironment,
  requiredStagehandProviderEnvKeys,
} from '@/qa/agentic/modelEnv.mjs';
import {
  scoreAgenticManifest,
  writeAgenticCriticArtifacts,
} from '@/qa/agentic/critic.mjs';

function createManifest(overrides = {}) {
  const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);

  return {
    version: 1,
    runId: 'test-run',
    target: 'local',
    baseUrl: 'http://localhost:3000',
    mission,
    startedAt: '2026-04-23T00:00:00.000Z',
    finishedAt: '2026-04-23T00:00:01.000Z',
    status: 'PASS',
    checks: [{ name: 'signed-in join completed', status: 'PASS' }],
    observations: [
      { actor: 'host', label: 'lobby', text: 'Canary Clerk User' },
    ],
    runtimeErrors: [],
    screenshots: mission.requiredScreenshots.map((label) => ({
      label,
      file: `${label}.png`,
    })),
    transcript: [],
    ...overrides,
  };
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe('agentic QA mission config', () => {
  it('resolves named missions and rejects unknown targets', () => {
    expect(resolveAgenticMission('guest-host-signed-in-join').title).toBe(
      'Guest host, signed-in joiner'
    );
    expect(resolveAgenticMission('signed-in-host-guest-join').title).toBe(
      'Signed-in host, guest joiner'
    );
    expect(() => normalizeAgenticTarget('production')).toThrow(
      /Expected local or preview/
    );
  });

  it('lists missions defensively and rejects unknown mission ids', () => {
    const listed = listAgenticMissions();

    expect(listed).toHaveLength(2);
    listed[0]!.title = 'mutated';

    expect(resolveAgenticMission(DEFAULT_AGENTIC_MISSION).title).toBe(
      'Guest host, signed-in joiner'
    );
    expect(() => resolveAgenticMission('missing-mission')).toThrow(
      /Unknown agentic QA mission/
    );
  });

  it('requires an explicit preview base URL', () => {
    expect(
      resolveAgenticBaseUrl({
        target: 'local',
        baseUrl: '',
      })
    ).toBe('http://localhost:3000');
    expect(() =>
      resolveAgenticBaseUrl({
        target: 'preview',
        baseUrl: '',
      })
    ).toThrow(/PLAYWRIGHT_BASE_URL/);
  });

  it('normalizes explicit targets, urls, and run ids', () => {
    expect(normalizeAgenticTarget('preview')).toBe('preview');
    expect(
      resolveAgenticBaseUrl({
        target: 'preview',
        baseUrl: 'https://preview.linejam.app/',
      })
    ).toBe('https://preview.linejam.app');
    expect(
      createAgenticRunId({
        missionId: DEFAULT_AGENTIC_MISSION,
        now: new Date('2026-04-23T00:00:00.000Z'),
        target: 'preview',
      })
    ).toBe('2026-04-23T00-00-00-000Z-preview-guest-host-signed-in-join');
  });

  it('fails closed when an authenticated mission lacks Clerk env', () => {
    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);

    expect(() =>
      assertAgenticMissionEnvironment(mission, { NODE_ENV: 'test' })
    ).toThrow(/requires authenticated Clerk coverage/);
    expect(() =>
      assertAgenticMissionEnvironment(mission, {
        NODE_ENV: 'test',
        CLERK_SECRET_KEY: 'sk_test_example',
        CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      })
    ).not.toThrow();
  });
});

describe('agentic QA manifest helpers', () => {
  it('creates and finishes a manifest with the expected shape', () => {
    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);
    const manifest = createAgenticManifest({
      baseUrl: 'https://preview.linejam.app',
      mission,
      runId: 'run-123',
      startedAt: '2026-04-23T00:00:00.000Z',
      target: 'preview',
    });

    expect(manifest).toMatchObject({
      version: 1,
      runId: 'run-123',
      status: 'RUNNING',
      baseUrl: 'https://preview.linejam.app',
      observations: [],
      runtimeErrors: [],
      screenshots: [],
      transcript: [],
    });

    const finished = markAgenticManifestFinished(
      manifest,
      'PASS',
      new Date('2026-04-23T00:00:01.000Z')
    );

    expect(finished.status).toBe('PASS');
    expect(finished.finishedAt).toBe('2026-04-23T00:00:01.000Z');
  });

  it('detects generic error variants and truncates long excerpts', () => {
    const genericErrors = detectGenericErrors([
      'Something went wrong while joining the room.',
      `${'x'.repeat(200)} application error`,
    ]);

    expect(genericErrors).toHaveLength(2);
    expect(genericErrors[0]?.pattern).toContain('something went wrong');
    expect(genericErrors[1]?.excerpt.length).toBeLessThanOrEqual(160);
    expect(detectGenericErrors(['All clear.'])).toEqual([]);
  });

  it('validates malformed manifests and failing checks', () => {
    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);

    expect(validateAgenticManifest(null, mission)).toEqual({
      ok: false,
      errors: ['manifest must be an object'],
    });

    const result = validateAgenticManifest(
      createManifest({
        version: 2,
        status: 'BROKEN',
        checks: [{ name: 'join completed', status: 'FAIL' }],
      }),
      mission
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('manifest version must be 1');
    expect(result.errors).toContain('status must be RUNNING, PASS, or FAIL');
    expect(result.errors).toContain('check failed: join completed');
  });
});

describe('agentic QA Stagehand model environment', () => {
  it('requires OPENAI_API_KEY for the default OpenAI Stagehand model', () => {
    expect(() =>
      assertStagehandModelEnvironment({
        env: { NODE_ENV: 'test' },
        model: 'openai/gpt-4.1-mini',
      })
    ).toThrow(/OPENAI_API_KEY/);
    expect(() =>
      assertStagehandModelEnvironment({
        env: { NODE_ENV: 'test', OPENAI_API_KEY: 'sk-test' },
        model: 'openai/gpt-4.1-mini',
      })
    ).not.toThrow();
  });

  it('accepts Google provider keys for Gemini Stagehand models', () => {
    expect(() =>
      assertStagehandModelEnvironment({
        env: { NODE_ENV: 'test', GOOGLE_GENERATIVE_AI_API_KEY: 'google-key' },
        model: 'gemini-2.0-flash',
      })
    ).not.toThrow();
  });

  it('maps provider-specific env requirements across supported model families', () => {
    expect(requiredStagehandProviderEnvKeys('claude-sonnet-4-5')).toEqual([
      'ANTHROPIC_API_KEY',
    ]);
    expect(requiredStagehandProviderEnvKeys('groq/llama-3.3-70b')).toEqual([
      'GROQ_API_KEY',
    ]);
    expect(
      requiredStagehandProviderEnvKeys('cerebras/llama-4-scout-17b')
    ).toEqual(['CEREBRAS_API_KEY']);
    expect(requiredStagehandProviderEnvKeys('custom-model')).toEqual([
      'ANTHROPIC_API_KEY',
      'CEREBRAS_API_KEY',
      'GOOGLE_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'GROQ_API_KEY',
      'OPENAI_API_KEY',
    ]);
  });

  it('accepts Anthropic, Groq, Cerebras, and fallback provider credentials', () => {
    expect(() =>
      assertStagehandModelEnvironment({
        env: { NODE_ENV: 'test', ANTHROPIC_API_KEY: 'anthropic-key' },
        model: 'claude-sonnet-4-5',
      })
    ).not.toThrow();
    expect(() =>
      assertStagehandModelEnvironment({
        env: { NODE_ENV: 'test', GROQ_API_KEY: 'groq-key' },
        model: 'groq/llama-3.3-70b',
      })
    ).not.toThrow();
    expect(() =>
      assertStagehandModelEnvironment({
        env: { NODE_ENV: 'test', CEREBRAS_API_KEY: 'cerebras-key' },
        model: 'cerebras/llama-4-scout-17b',
      })
    ).not.toThrow();
    expect(() =>
      assertStagehandModelEnvironment({
        env: { NODE_ENV: 'test', GOOGLE_API_KEY: 'google-key' },
        model: 'custom-model',
      })
    ).not.toThrow();
  });
});

describe('agentic QA critic', () => {
  it('passes a healthy mission manifest', () => {
    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);
    const result = scoreAgenticManifest(createManifest(), mission);

    expect(result.verdict).toBe('pass');
    expect(result.blockingReasons).toEqual([]);
  });

  it('fails a manifest that shows generic join error UI', () => {
    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);
    const result = scoreAgenticManifest(
      createManifest({
        observations: [
          {
            actor: 'signed-in-joiner',
            label: 'join',
            text: 'An unexpected error occurred while joining the room.',
          },
        ],
      }),
      mission
    );

    expect(result.verdict).toBe('fail');
    expect(result.blockingReasons.join('\n')).toMatch(/generic error UI/);
  });

  it('fails a manifest that is missing required screenshot artifacts', () => {
    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);
    const result = scoreAgenticManifest(
      createManifest({
        screenshots: [{ label: 'host-lobby', file: 'host-lobby.png' }],
      }),
      mission
    );

    expect(result.verdict).toBe('fail');
    expect(result.blockingReasons).toContain(
      'missing required screenshot: signed-in-joined'
    );
  });

  it('fails a manifest that captured browser runtime errors', () => {
    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);
    const result = scoreAgenticManifest(
      createManifest({
        runtimeErrors: ['[host] console: application exploded'],
      }),
      mission
    );

    expect(result.verdict).toBe('fail');
    expect(result.blockingReasons).toContain('runtime errors captured: 1');
  });

  it('writes critic artifacts for both passing and failing manifests', async () => {
    const passDir = await mkdtemp(
      path.join(os.tmpdir(), 'linejam-agentic-pass-')
    );
    const failDir = await mkdtemp(
      path.join(os.tmpdir(), 'linejam-agentic-fail-')
    );
    tempDirs.push(passDir, failDir);

    const mission = resolveAgenticMission(DEFAULT_AGENTIC_MISSION);
    const passArtifacts = await writeAgenticCriticArtifacts({
      manifest: createManifest(),
      mission,
      outDir: passDir,
    });
    const failArtifacts = await writeAgenticCriticArtifacts({
      manifest: createManifest({
        observations: [
          {
            actor: 'joiner',
            label: 'join',
            text: 'Something went wrong while joining.',
          },
        ],
      }),
      mission,
      outDir: failDir,
    });

    expect(passArtifacts.verdict).toBe('pass');
    expect(failArtifacts.verdict).toBe('fail');
    await expect(
      readFile(passArtifacts.summaryPath, 'utf8')
    ).resolves.toContain('- None');
    await expect(readFile(failArtifacts.resultPath, 'utf8')).resolves.toContain(
      '"verdict": "fail"'
    );
    await expect(
      readFile(failArtifacts.summaryPath, 'utf8')
    ).resolves.toContain('generic error UI detected');
  });
});
