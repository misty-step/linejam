/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import {
  diffDigitalOceanApp,
  loadDigitalOceanAppManifest,
  normalizeDigitalOceanApp,
  runDigitalOceanDriftCheck,
  validateDigitalOceanAppManifest,
} from '@/scripts/ops/check-digitalocean-app-drift.mjs';

const manifest = {
  schemaVersion: 1 as const,
  deploymentAuthority: {
    source: { repository: 'misty-step/linejam', branch: 'master' },
    frontendProductionOwner: { app: 'linejam', component: 'web' },
    convexProductionOwner: {
      app: 'linejam',
      component: 'web',
      buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
    },
  },
  apps: [
    {
      id: 'app-web',
      name: 'linejam',
      region: 'nyc',
      features: ['buildpack-stack=ubuntu-22'],
      domains: [
        { domain: 'linejam.app', type: 'PRIMARY', zone: 'linejam.app' },
      ],
      ingress: [{ pathPrefix: '/', component: 'web' }],
      services: [
        {
          name: 'web',
          source: {
            repository: 'misty-step/linejam',
            branch: 'master',
            deployOnPush: true,
          },
          buildCommand: 'pnpm install --frozen-lockfile && pnpm build',
          runCommand: 'pnpm run start:next',
          httpPort: 3000,
          instanceCount: 1,
          instanceSize: 'apps-s-1vcpu-1gb',
          healthCheckPath: '/api/health',
          environment: [
            {
              name: 'GUEST_TOKEN_SECRET',
              scope: 'RUN_AND_BUILD_TIME',
              secret: true,
            },
            {
              name: 'LINEJAM_DEPLOY_ENVIRONMENT',
              scope: 'RUN_AND_BUILD_TIME',
              secret: false,
            },
          ],
        },
      ],
    },
  ],
};

function liveApp() {
  return {
    id: 'app-web',
    active_deployment: { id: 'generated-deployment', phase: 'ACTIVE' },
    spec: {
      name: 'linejam',
      region: 'nyc',
      features: ['buildpack-stack=ubuntu-22'],
      domains: [
        { domain: 'linejam.app', type: 'PRIMARY', zone: 'linejam.app' },
      ],
      ingress: {
        rules: [
          {
            match: { path: { prefix: '/' } },
            component: { name: 'web' },
          },
        ],
      },
      services: [
        {
          name: 'web',
          github: {
            repo: 'misty-step/linejam',
            branch: 'master',
            deploy_on_push: true,
          },
          build_command: 'pnpm install --frozen-lockfile && pnpm build',
          run_command: 'pnpm run start:next',
          http_port: 3000,
          instance_count: 1,
          instance_size_slug: 'apps-s-1vcpu-1gb',
          health_check: { http_path: '/api/health' },
          envs: [
            {
              key: 'LINEJAM_DEPLOY_ENVIRONMENT',
              scope: 'RUN_AND_BUILD_TIME',
              value: 'production',
            },
            {
              key: 'GUEST_TOKEN_SECRET',
              scope: 'RUN_AND_BUILD_TIME',
              type: 'SECRET',
              value: 'EV[1:provider-ciphertext]',
            },
          ],
        },
      ],
    },
  };
}

describe('DigitalOcean app drift', () => {
  it('loads the committed values-free production contract', () => {
    const committed = loadDigitalOceanAppManifest();

    expect(committed.apps.map((app: { name: string }) => app.name)).toEqual([
      'linejam',
      'linejam-canary-responder',
    ]);
    expect(JSON.stringify(committed)).not.toContain('value');
    expect(committed.deploymentAuthority).toMatchObject({
      frontendProductionOwner: { app: 'linejam', component: 'web' },
      convexProductionOwner: { app: 'linejam', component: 'web' },
    });
  });

  it('validates a values-free manifest with one frontend and Convex owner', () => {
    expect(validateDigitalOceanAppManifest(manifest)).toEqual(manifest);
    expect(() =>
      validateDigitalOceanAppManifest({
        ...manifest,
        apps: [
          {
            ...manifest.apps[0],
            services: [
              {
                ...manifest.apps[0].services[0],
                environment: [
                  {
                    name: 'GUEST_TOKEN_SECRET',
                    scope: 'RUN_AND_BUILD_TIME',
                    secret: true,
                    value: 'must-not-be-committed',
                  },
                ],
              },
            ],
          },
        ],
      })
    ).toThrow('values-free');
  });

  it('rejects services that diverge from the declared source authority', () => {
    expect(() =>
      validateDigitalOceanAppManifest({
        ...manifest,
        apps: [
          {
            ...manifest.apps[0],
            services: [
              {
                ...manifest.apps[0].services[0],
                source: {
                  ...manifest.apps[0].services[0].source,
                  branch: 'feature/drift',
                },
              },
            ],
          },
        ],
      })
    ).toThrow('must use the declared source');
  });

  it('normalizes meaningful fields and discards provider fields and values', () => {
    const normalized = normalizeDigitalOceanApp(liveApp());

    expect(normalized).toEqual(manifest.apps[0]);
    expect(JSON.stringify(normalized)).not.toContain('provider-ciphertext');
    expect(JSON.stringify(normalized)).not.toContain('generated-deployment');
  });

  it('reports no drift for equivalent normalized state', () => {
    expect(
      diffDigitalOceanApp(manifest.apps[0], normalizeDigitalOceanApp(liveApp()))
    ).toEqual([]);
  });

  it('reports meaningful drift without replaying environment values', () => {
    const live = liveApp();
    live.spec.services[0].build_command = 'pnpm exec next build';
    live.spec.services[0].envs[1].value = 'must-never-appear';

    const drift = diffDigitalOceanApp(
      manifest.apps[0],
      normalizeDigitalOceanApp(live)
    );

    expect(drift).toContainEqual(
      expect.objectContaining({ path: 'services.web.buildCommand' })
    );
    expect(JSON.stringify(drift)).not.toContain('must-never-appear');
  });

  it('detects added environment names while discarding their values', () => {
    const live = liveApp();
    live.spec.services[0].envs.push({
      key: 'UNDECLARED_NAME',
      scope: 'RUN_AND_BUILD_TIME',
      value: 'must-never-appear',
    });

    const drift = diffDigitalOceanApp(
      manifest.apps[0],
      normalizeDigitalOceanApp(live)
    );

    expect(drift).toContainEqual(
      expect.objectContaining({
        path: 'services.web.environment.UNDECLARED_NAME',
      })
    );
    expect(JSON.stringify(drift)).not.toContain('must-never-appear');
  });

  it('fails closed on live components outside the declared service model', () => {
    const live = liveApp();
    Object.assign(live.spec, {
      workers: [
        {
          name: 'shadow-deployer',
          github: { repo: 'misty-step/linejam', branch: 'master' },
        },
      ],
    });

    expect(() => normalizeDigitalOceanApp(live)).toThrow(
      'unsupported live field spec.workers'
    );
  });

  it('fails closed on unknown live service fields', () => {
    const live = liveApp();
    Object.assign(live.spec.services[0], {
      autoscaling: { min_instance_count: 1, max_instance_count: 3 },
    });

    expect(() => normalizeDigitalOceanApp(live)).toThrow(
      'service web has unsupported fields: autoscaling'
    );
  });

  it('rejects duplicate live environment names before comparison', () => {
    const live = liveApp();
    live.spec.services[0].envs.push({
      ...live.spec.services[0].envs[0],
      value: 'another-value',
    });

    expect(() => normalizeDigitalOceanApp(live)).toThrow(
      'environment contains duplicates'
    );
  });

  it('bounds provider reads and emits only a values-free receipt', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify([liveApp()]),
      stderr: 'provider warning GUEST_TOKEN_SECRET=must-not-replay',
    });
    const logger = { log: vi.fn() };

    expect(
      runDigitalOceanDriftCheck({ manifest, runner, logger })
    ).toMatchObject({ checkedApps: ['linejam'], drift: [] });
    expect(runner).toHaveBeenCalledWith(
      'doctl',
      ['apps', 'get', 'app-web', '--output', 'json'],
      expect.objectContaining({
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      })
    );
    expect(logger.log).toHaveBeenCalledWith(
      'READY: DigitalOcean app drift clean for linejam'
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      'must-not-replay'
    );
  });

  it('fails when another live app deploys the declared source branch', () => {
    const duplicate = liveApp();
    duplicate.id = 'app-shadow';
    duplicate.spec.name = 'linejam-shadow';
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify([liveApp(), duplicate]),
      stderr: '',
    });

    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner,
        logger: { log: vi.fn() },
      })
    ).toThrow(
      'DigitalOcean source-app drift: missing=none; unexpected=linejam-shadow'
    );
  });

  it('fails closed without replaying provider output', () => {
    const providerOutput = 'GUEST_TOKEN_SECRET=must-not-replay';
    let error: unknown;
    try {
      runDigitalOceanDriftCheck({
        manifest,
        runner: vi.fn().mockReturnValue({
          status: 1,
          stdout: providerOutput,
          stderr: providerOutput,
        }),
        logger: { log: vi.fn() },
      });
    } catch (caught) {
      error = caught;
    }

    expect(String(error)).toContain('provider read failed with status 1');
    expect(String(error)).not.toContain('must-not-replay');
  });

  it('fails closed when the provider read times out', () => {
    const timeout = Object.assign(new Error('must-not-replay'), {
      code: 'ETIMEDOUT',
    });

    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner: vi.fn().mockReturnValue({ status: null, error: timeout }),
        logger: { log: vi.fn() },
      })
    ).toThrow('DigitalOcean app inventory provider read timed out');
  });

  it('rejects invalid provider JSON without replaying it', () => {
    const providerOutput = '{GUEST_TOKEN_SECRET=must-not-replay';
    let error: unknown;
    try {
      runDigitalOceanDriftCheck({
        manifest,
        runner: vi.fn().mockReturnValue({
          status: 0,
          stdout: providerOutput,
          stderr: providerOutput,
        }),
        logger: { log: vi.fn() },
      });
    } catch (caught) {
      error = caught;
    }

    expect(String(error)).toContain('inventory returned invalid JSON');
    expect(String(error)).not.toContain('must-not-replay');
  });
});
