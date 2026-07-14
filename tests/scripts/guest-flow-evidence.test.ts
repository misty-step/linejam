/** @vitest-environment node */
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  issueArtifact,
  issueMessage,
  parseEvidenceWaivers,
  resolveEvidenceVerdict,
} from '@/scripts/evidence/verdict.mjs';
import {
  collectFileArtifactErrors,
  copyServerLog,
  normalizeEvidenceResult,
  parseArgs,
} from '@/scripts/evidence/guest-flow-artifacts.mjs';
import {
  attachGuestFlowRuntimeErrorLogging,
  isolateGuestSessionIp,
} from '@/tests/e2e/support/guestFlow';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('guest-flow evidence verdicts', () => {
  it('isolates local production browsers through the trusted ingress header', async () => {
    let routePattern = '';
    let routeHandler:
      | ((route: {
          continue(options: { headers: Record<string, string> }): Promise<void>;
          request(): { headers(): Record<string, string> };
        }) => Promise<void>)
      | undefined;
    let continuedHeaders: Record<string, string> | undefined;
    const context = {
      async route(pattern: string, handler: NonNullable<typeof routeHandler>) {
        routePattern = pattern;
        routeHandler = handler;
      },
    };

    const ip = await isolateGuestSessionIp(
      context as unknown as Parameters<typeof isolateGuestSessionIp>[0]
    );
    await routeHandler?.({
      async continue({ headers }) {
        continuedHeaders = headers;
      },
      request() {
        return { headers: () => ({ accept: 'application/json' }) };
      },
    });

    expect(routePattern).toBe('**/api/guest/session*');
    expect(ip).toMatch(/^10(?:\.\d{1,3}){3}$/);
    expect(continuedHeaders).toEqual({
      accept: 'application/json',
      'do-connecting-ip': ip,
    });
    expect(continuedHeaders).not.toHaveProperty('x-forwarded-for');
  });

  it('passes clean evidence without waivers', () => {
    expect(resolveEvidenceVerdict({})).toMatchObject({
      result: 'PASS',
      unwaivedRuntimeErrors: [],
      unwaivedArtifactErrors: [],
    });
    expect(parseEvidenceWaivers(null)).toEqual({
      runtimeErrors: [],
      artifactErrors: [],
    });
    expect(parseEvidenceWaivers({})).toEqual({
      runtimeErrors: [],
      artifactErrors: [],
    });
    expect(issueArtifact('plain artifact failure')).toBe('artifact');
    expect(issueMessage('plain artifact failure')).toBe(
      'plain artifact failure'
    );
  });

  it('fails flow errors even when no runtime or artifact errors are present', () => {
    expect(
      resolveEvidenceVerdict({
        flowError: 'Timed out waiting for session complete',
      })
    ).toMatchObject({
      result: 'FAIL',
      unwaivedRuntimeErrors: [],
      unwaivedArtifactErrors: [],
    });
  });

  it('fails runtime errors until a typed, unexpired waiver matches', () => {
    const runtimeErrors = ['[console:error] Convex mutation failed'];

    expect(
      resolveEvidenceVerdict({
        runtimeErrors,
      })
    ).toMatchObject({
      result: 'FAIL',
      unwaivedRuntimeErrors: runtimeErrors,
    });

    const waivers = parseEvidenceWaivers(
      {
        runtimeErrors: [
          {
            pattern: 'Convex mutation failed',
            reason: 'Tracked preview-only Convex outage',
            expiresOn: '2026-12-31',
          },
        ],
      },
      { now: new Date('2026-06-11T00:00:00Z') }
    );

    expect(
      resolveEvidenceVerdict({
        runtimeErrors,
        waivers,
      })
    ).toMatchObject({
      result: 'PASS_WITH_WAIVERS',
      unwaivedRuntimeErrors: [],
      waivedRuntimeErrors: [
        {
          error: runtimeErrors[0],
          waiver: expect.objectContaining({
            reason: 'Tracked preview-only Convex outage',
          }),
        },
      ],
    });
  });

  it('fails artifact packaging and completeness errors unless explicitly waived', () => {
    const artifactErrors = [
      { artifact: 'video', message: 'Packaged host video is missing.' },
      { artifact: 'serverLog', message: 'Evidence server log is missing.' },
    ];

    expect(
      resolveEvidenceVerdict({
        artifactErrors,
      })
    ).toMatchObject({
      result: 'FAIL',
      unwaivedArtifactErrors: artifactErrors,
    });

    const waivers = parseEvidenceWaivers(
      {
        artifactErrors: [
          {
            artifact: 'video',
            reason: 'Browser did not emit video on this runner',
            expiresOn: '2026-12-31',
          },
          {
            artifact: 'serverLog',
            reason: 'Remote target has no local server process',
            expiresOn: '2026-12-31',
          },
        ],
      },
      { now: new Date('2026-06-11T00:00:00Z') }
    );

    expect(
      resolveEvidenceVerdict({
        artifactErrors,
        waivers,
      })
    ).toMatchObject({
      result: 'PASS_WITH_WAIVERS',
      unwaivedArtifactErrors: [],
      waivedArtifactErrors: [
        {
          error: artifactErrors[0],
          waiver: expect.objectContaining({ artifact: 'video' }),
        },
        {
          error: artifactErrors[1],
          waiver: expect.objectContaining({ artifact: 'serverLog' }),
        },
      ],
    });
  });

  it('still fails when only some artifact errors are waived', () => {
    const artifactErrors = [
      { artifact: 'video', message: 'Packaged host video is missing.' },
      { artifact: 'serverLog', message: 'Evidence server log is missing.' },
    ];
    const waivers = parseEvidenceWaivers(
      {
        artifactErrors: [
          {
            artifact: 'video',
            reason: 'Browser did not emit video on this runner',
            expiresOn: '2026-12-31',
          },
        ],
      },
      { now: new Date('2026-06-11T00:00:00Z') }
    );

    expect(
      resolveEvidenceVerdict({
        artifactErrors,
        waivers,
      })
    ).toMatchObject({
      result: 'FAIL',
      unwaivedArtifactErrors: [artifactErrors[1]],
      waivedArtifactErrors: [
        {
          error: artifactErrors[0],
          waiver: expect.objectContaining({ artifact: 'video' }),
        },
      ],
    });
  });

  it('rejects stale or malformed waiver entries', () => {
    expect(() => parseEvidenceWaivers([])).toThrow(/JSON object/);

    expect(() =>
      parseEvidenceWaivers({
        runtimeErrors: [null],
      })
    ).toThrow(/runtimeErrors\[0\]/);

    expect(() =>
      parseEvidenceWaivers(
        {
          runtimeErrors: [
            {
              pattern: 'known issue',
              reason: 'Expired waiver',
              expiresOn: '2026-01-01',
            },
          ],
        },
        { now: new Date('2026-06-11T00:00:00Z') }
      )
    ).toThrow(/expired/);

    expect(() =>
      parseEvidenceWaivers({
        artifactErrors: [null],
      })
    ).toThrow(/artifactErrors\[0\]/);

    expect(() =>
      parseEvidenceWaivers(
        {
          artifactErrors: [
            {
              artifact: 'video',
              reason: 'Expired waiver',
              expiresOn: '2026-01-01',
            },
          ],
        },
        { now: new Date('2026-06-11T00:00:00Z') }
      )
    ).toThrow(/expired/);

    expect(() =>
      parseEvidenceWaivers({
        artifactErrors: [
          {
            artifact: 'unknown',
            reason: 'Bad artifact',
            expiresOn: '2026-12-31',
          },
        ],
      })
    ).toThrow(/artifactErrors\[0\]/);

    expect(() =>
      parseEvidenceWaivers({
        runtimeErrors: [
          {
            pattern: '[',
            reason: 'Bad regex',
            expiresOn: '2026-12-31',
          },
        ],
      })
    ).toThrow(/valid regular expression/);

    expect(() =>
      parseEvidenceWaivers({
        runtimeErrors: [
          {
            pattern: 'known issue',
            reason: 'Bad date',
            expiresOn: 'tomorrow',
          },
        ],
      })
    ).toThrow(/runtimeErrors\[0\]/);
  });

  it('parses guest-flow CLI args over environment defaults', () => {
    expect(
      parseArgs(
        [
          '--allowlist',
          'waivers.json',
          '--base-url',
          'https://preview.linejam.app',
          '--out-dir',
          '/tmp/evidence',
          '--server-log',
          '/tmp/server.log',
        ],
        {
          ...process.env,
          LINEJAM_BASE_URL: 'https://www.linejam.app',
          LINEJAM_EVIDENCE_ALLOWLIST: 'env-waivers.json',
          LINEJAM_EVIDENCE_DIR: '/tmp/env-evidence',
          LINEJAM_EVIDENCE_SERVER_LOG: '/tmp/env-server.log',
        },
        new Date('2026-06-11T00:00:00Z')
      )
    ).toEqual({
      allowlistPath: 'waivers.json',
      baseUrl: 'https://preview.linejam.app',
      outDir: '/tmp/evidence',
      serverLogPath: '/tmp/server.log',
    });

    expect(
      parseArgs([], {} as NodeJS.ProcessEnv, new Date('2026-06-11T00:00:00Z'))
    ).toMatchObject({
      allowlistPath: '',
      baseUrl: 'https://www.linejam.app',
      outDir: expect.stringContaining(
        'linejam-evidence-2026-06-11T00-00-00-000Z'
      ),
      serverLogPath: '',
    });
  });

  it('normalizes malformed guest-flow result payloads before verdicting', () => {
    expect(
      normalizeEvidenceResult(
        'https://fallback.linejam.app',
        {
          baseUrl: '',
          checks: ['created room', 42],
          flowError: 500,
          rawVideoPath: 123,
          roomCode: null,
          runtimeErrors: ['[pageerror] boom', { message: 'object' }],
          screenshots: ['01-host-lobby.png', 2],
        },
        new Error('playwright failed')
      )
    ).toEqual({
      baseUrl: 'https://fallback.linejam.app',
      checks: ['created room', '42'],
      flowError: 'playwright failed',
      rawVideoPath: null,
      roomCode: '',
      runtimeErrors: ['[pageerror] boom', '[object Object]'],
      screenshots: ['01-host-lobby.png', '2'],
    });

    expect(
      normalizeEvidenceResult(
        'https://fallback.linejam.app',
        {
          baseUrl: 'https://actual.linejam.app',
          checks: null,
          flowError: 'room failed',
          rawVideoPath: '/tmp/raw-video.webm',
          roomCode: 'ABCD',
          runtimeErrors: null,
          screenshots: null,
        },
        'string failure'
      )
    ).toEqual({
      baseUrl: 'https://actual.linejam.app',
      checks: [],
      flowError: 'room failed',
      rawVideoPath: '/tmp/raw-video.webm',
      roomCode: 'ABCD',
      runtimeErrors: [],
      screenshots: [],
    });

    expect(
      normalizeEvidenceResult('https://fallback.linejam.app', null, 'failed')
        .flowError
    ).toBe('failed');
  });

  it('copies configured server logs into the evidence directory', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'linejam-evidence-test-'));
    const serverLogSource = path.join(outDir, 'source.log');
    await writeFile(serverLogSource, 'server ready\n', 'utf8');

    const result = await copyServerLog(serverLogSource, outDir);

    expect(result).toEqual({
      serverLogPath: path.join(outDir, 'server.log'),
      artifactError: null,
    });
    await expect(readFile(result.serverLogPath!, 'utf8')).resolves.toBe(
      'server ready\n'
    );
  });

  it('reports missing server logs as artifact errors', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'linejam-evidence-test-'));

    await expect(copyServerLog('', outDir)).resolves.toEqual({
      serverLogPath: null,
      artifactError: {
        artifact: 'serverLog',
        message: 'LINEJAM_EVIDENCE_SERVER_LOG is not configured.',
      },
    });

    await expect(
      copyServerLog(path.join(outDir, 'missing.log'), outDir)
    ).resolves.toEqual({
      serverLogPath: null,
      artifactError: {
        artifact: 'serverLog',
        message: `Evidence server log does not exist: ${path.join(outDir, 'missing.log')}`,
      },
    });
  });

  it('validates screenshot, video, and server-log artifacts before pass', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'linejam-evidence-test-'));
    const screenshotPath = path.join(outDir, '01-host-lobby.png');
    const videoPath = path.join(outDir, 'guest-flow.webm');
    const gifPath = path.join(outDir, 'guest-flow.gif');
    const serverLogPath = path.join(outDir, 'server.log');
    await writeFile(screenshotPath, 'png bytes', 'utf8');
    await writeFile(videoPath, 'video bytes', 'utf8');
    await writeFile(gifPath, 'gif bytes', 'utf8');
    await writeFile(serverLogPath, 'server log', 'utf8');

    await expect(
      collectFileArtifactErrors({
        gifPath,
        outDir,
        screenshots: ['01-host-lobby.png'],
        serverLogPath,
        videoPath,
      })
    ).resolves.toEqual([]);

    await expect(
      collectFileArtifactErrors({
        gifPath: null,
        outDir,
        screenshots: ['missing.png'],
        serverLogPath: null,
        videoPath: null,
      })
    ).resolves.toEqual([
      { artifact: 'screenshot', message: 'Screenshot is missing: missing.png' },
      { artifact: 'video', message: 'Packaged host video is missing.' },
      { artifact: 'gif', message: 'Generated GIF is missing.' },
      { artifact: 'serverLog', message: 'Evidence server log is missing.' },
    ]);

    await expect(
      collectFileArtifactErrors({
        gifPath: path.join(outDir, 'missing.gif'),
        outDir,
        screenshots: [],
        serverLogPath,
        videoPath,
      })
    ).resolves.toEqual([
      { artifact: 'screenshot', message: 'No screenshots were captured.' },
      { artifact: 'gif', message: 'Generated GIF is missing.' },
    ]);
  });

  it('collects browser page, console, request, and response errors as runtime errors', () => {
    const page = new EventEmitter();
    const runtimeErrors: string[] = [];
    attachGuestFlowRuntimeErrorLogging(
      page as unknown as Parameters<
        typeof attachGuestFlowRuntimeErrorLogging
      >[0],
      'host',
      runtimeErrors
    );

    page.emit('pageerror', new Error('render exploded'));
    page.emit('console', {
      type: () => 'error',
      text: () => 'Convex mutation failed',
      location: () => ({ url: '' }),
    });
    page.emit('console', {
      type: () => 'warning',
      text: () => 'non-blocking warning',
      location: () => ({ url: '' }),
    });
    page.emit('requestfailed', {
      method: () => 'POST',
      url: () => 'https://www.linejam.app/api/guest/session',
      failure: () => ({ errorText: 'net::ERR_FAILED' }),
    });
    page.emit('response', {
      status: () => 500,
      url: () => 'https://www.linejam.app/api/guest/session',
      request: () => ({ method: () => 'GET' }),
    });
    page.emit('response', {
      status: () => 200,
      url: () => 'https://www.linejam.app/host',
      request: () => ({ method: () => 'GET' }),
    });

    expect(runtimeErrors).toEqual([
      '[host] pageerror: render exploded',
      '[host] console: Convex mutation failed',
      '[host] requestfailed: POST https://www.linejam.app/api/guest/session net::ERR_FAILED',
      '[host] response: 500 GET https://www.linejam.app/api/guest/session',
    ]);

    expect(resolveEvidenceVerdict({ runtimeErrors })).toMatchObject({
      result: 'FAIL',
      unwaivedRuntimeErrors: runtimeErrors,
    });
  });

  it('ignores only aborted RSC requests from local evidence runs', () => {
    const page = new EventEmitter();
    const runtimeErrors: string[] = [];
    attachGuestFlowRuntimeErrorLogging(
      page as unknown as Parameters<
        typeof attachGuestFlowRuntimeErrorLogging
      >[0],
      'host',
      runtimeErrors
    );

    page.emit('requestfailed', {
      method: () => 'GET',
      url: () => 'http://127.0.0.1:3333/room/ABCD?_rsc=abc123',
      failure: () => ({ errorText: 'net::ERR_ABORTED' }),
    });
    page.emit('requestfailed', {
      method: () => 'GET',
      url: () => 'http://127.0.0.1:3333/room/ABCD',
      failure: () => ({ errorText: 'net::ERR_ABORTED' }),
    });

    expect(runtimeErrors).toEqual([
      '[host] requestfailed: GET http://127.0.0.1:3333/room/ABCD net::ERR_ABORTED',
    ]);
  });
});
