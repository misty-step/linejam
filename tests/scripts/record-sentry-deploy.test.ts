import { describe, expect, it, vi } from 'vitest';
import {
  recordSentryDeploy,
  runFromEnv,
} from '../../scripts/ops/record-sentry-deploy.mjs';

const RELEASE = 'a'.repeat(40);
const INPUT = {
  token: 'test-release-token',
  organization: 'misty-step',
  project: 'linejam',
  release: RELEASE,
  environment: 'production',
  runUrl: 'https://github.com/misty-step/linejam/actions/runs/123',
  now: new Date('2026-08-16T15:00:00.000Z'),
};

function releaseResponse() {
  return Response.json({
    version: RELEASE,
    projects: [{ slug: 'linejam' }],
  });
}

describe('Sentry deploy marker', () => {
  it('records one production deploy against the served release', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(releaseResponse())
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ id: 'deploy-1' }));

    await expect(recordSentryDeploy({ ...INPUT, fetchImpl })).resolves.toEqual({
      recorded: true,
      release: RELEASE,
      environment: 'production',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `https://sentry.io/api/0/organizations/misty-step/releases/${RELEASE}/`
    );
    expect(fetchImpl.mock.calls[1][0]).toBe(
      `https://sentry.io/api/0/organizations/misty-step/releases/${RELEASE}/deploys/`
    );
    expect(fetchImpl.mock.calls[2][0]).toBe(
      `https://sentry.io/api/0/organizations/misty-step/releases/${RELEASE}/deploys/`
    );
    expect(fetchImpl.mock.calls[2][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        environment: 'production',
        name: 'github-actions-production-smoke',
        url: INPUT.runUrl,
        dateFinished: INPUT.now.toISOString(),
      }),
    });
  });

  it('is idempotent when the release already has a production deploy', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(releaseResponse())
      .mockResolvedValueOnce(
        Response.json([{ id: 'deploy-1', environment: 'production' }])
      );

    await expect(
      recordSentryDeploy({ ...INPUT, fetchImpl })
    ).resolves.toMatchObject({ recorded: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects ambiguous release ownership before creating a deploy', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ version: RELEASE, projects: [{ slug: 'other' }] })
      );

    await expect(recordSentryDeploy({ ...INPUT, fetchImpl })).rejects.toThrow(
      'does not belong to the Linejam project'
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not expose provider response bodies on failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response('PROHIBITED_PROVIDER_BODY', { status: 403 })
      );

    await expect(recordSentryDeploy({ ...INPUT, fetchImpl })).rejects.toThrow(
      'HTTP 403'
    );
    await expect(
      recordSentryDeploy({ ...INPUT, fetchImpl })
    ).rejects.not.toThrow('PROHIBITED_PROVIDER_BODY');
  });

  it('rejects non-canonical inputs before any provider request', async () => {
    const fetchImpl = vi.fn();
    for (const overrides of [
      { organization: 'other' },
      { project: 'other' },
      { release: 'A'.repeat(40) },
      { environment: 'staging' },
      { runUrl: 'https://github.com/other/repo/actions/runs/1' },
      // SAFETY: This negative test deliberately violates the fetch dependency contract.
      { fetchImpl: null as never },
    ]) {
      await expect(
        recordSentryDeploy({ ...INPUT, fetchImpl, ...overrides })
      ).rejects.toThrow();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('validates release and deploy response shapes', async () => {
    await expect(
      recordSentryDeploy({
        ...INPUT,
        fetchImpl: vi.fn(async () => new Response(null, { status: 204 })),
      })
    ).rejects.toThrow('does not belong to the Linejam project');

    await expect(
      recordSentryDeploy({
        ...INPUT,
        fetchImpl: vi
          .fn()
          .mockResolvedValueOnce(releaseResponse())
          .mockResolvedValueOnce(Response.json({ deploys: [] })),
      })
    ).rejects.toThrow('deploy list has an invalid shape');

    await expect(
      recordSentryDeploy({
        ...INPUT,
        fetchImpl: vi.fn(async () => new Response('not-json')),
      })
    ).rejects.toThrow('returned invalid JSON');
  });

  it('requires every environment input', async () => {
    const completeEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      SENTRY_AUTH_TOKEN: INPUT.token,
      SENTRY_ORG: INPUT.organization,
      SENTRY_PROJECT: INPUT.project,
      NEXT_DEPLOYMENT_ID: INPUT.release,
      LINEJAM_DEPLOY_ENVIRONMENT: INPUT.environment,
      GITHUB_RUN_URL: INPUT.runUrl,
    };
    for (const name of Object.keys(completeEnv).filter(
      (name) => name !== 'NODE_ENV'
    )) {
      await expect(runFromEnv({ ...completeEnv, [name]: ' ' })).rejects.toThrow(
        `${name} is required`
      );
    }
  });
});
