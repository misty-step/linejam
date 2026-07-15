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

function manifestCopy(): typeof manifest {
  return structuredClone(manifest);
}

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

  it.each([
    {
      name: 'a non-object root',
      mutate: () => null,
      message: 'manifest must be an object',
    },
    {
      name: 'an unsupported root field',
      mutate: (copy: typeof manifest) => ({ ...copy, providerExport: true }),
      message: 'manifest has unsupported fields: providerExport',
    },
    {
      name: 'an unsupported schema version',
      mutate: (copy: typeof manifest) => ({ ...copy, schemaVersion: 2 }),
      message: 'manifest.schemaVersion must be 1',
    },
    {
      name: 'a non-boolean deploy-on-push flag',
      mutate: (copy: typeof manifest) => {
        Reflect.set(copy.deploymentAuthority.source, 'deployOnPush', 'yes');
        return copy;
      },
      message: 'deployOnPush must be boolean',
    },
    {
      name: 'no apps',
      mutate: (copy: typeof manifest) => ({ ...copy, apps: [] }),
      message: 'manifest.apps must be a non-empty array',
    },
    {
      name: 'duplicate app ids',
      mutate: (copy: typeof manifest) => {
        copy.apps.push({ ...structuredClone(copy.apps[0]), name: 'other' });
        return copy;
      },
      message: 'manifest.apps ids contains duplicates',
    },
    {
      name: 'duplicate app names',
      mutate: (copy: typeof manifest) => {
        copy.apps.push({ ...structuredClone(copy.apps[0]), id: 'other' });
        return copy;
      },
      message: 'manifest.apps names contains duplicates',
    },
    {
      name: 'non-array features',
      mutate: (copy: typeof manifest) => {
        Reflect.set(copy.apps[0], 'features', 'feature');
        return copy;
      },
      message: 'features and domains must be arrays',
    },
    {
      name: 'a blank domain',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].domains[0].domain = '';
        return copy;
      },
      message: 'domain must be a non-empty string',
    },
    {
      name: 'duplicate domains',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].domains.push(structuredClone(copy.apps[0].domains[0]));
        return copy;
      },
      message: 'domains contains duplicates',
    },
    {
      name: 'non-array ingress',
      mutate: (copy: typeof manifest) => {
        Reflect.set(copy.apps[0], 'ingress', null);
        return copy;
      },
      message: 'ingress and services must be arrays',
    },
    {
      name: 'duplicate ingress rules',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].ingress.push(structuredClone(copy.apps[0].ingress[0]));
        return copy;
      },
      message: 'ingress contains duplicates',
    },
    {
      name: 'duplicate service names',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].services.push(structuredClone(copy.apps[0].services[0]));
        return copy;
      },
      message: 'services contains duplicates',
    },
    {
      name: 'an invalid HTTP port',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].services[0].httpPort = 0;
        return copy;
      },
      message: 'httpPort must be a positive integer',
    },
    {
      name: 'an invalid instance count',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].services[0].instanceCount = 0;
        return copy;
      },
      message: 'instanceCount must be a positive integer',
    },
    {
      name: 'a non-array environment',
      mutate: (copy: typeof manifest) => {
        Reflect.set(copy.apps[0].services[0], 'environment', null);
        return copy;
      },
      message: 'environment must be an array',
    },
    {
      name: 'duplicate environment names',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].services[0].environment.push(
          structuredClone(copy.apps[0].services[0].environment[0])
        );
        return copy;
      },
      message: 'environment contains duplicates',
    },
    {
      name: 'an invalid environment name',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].services[0].environment[0].name = 'lowercase';
        return copy;
      },
      message: 'must be an environment variable name',
    },
    {
      name: 'a non-boolean secret flag',
      mutate: (copy: typeof manifest) => {
        Reflect.set(copy.apps[0].services[0].environment[0], 'secret', 'yes');
        return copy;
      },
      message: 'secret must be boolean',
    },
    {
      name: 'an unresolved frontend owner',
      mutate: (copy: typeof manifest) => {
        copy.deploymentAuthority.frontendProductionOwner.component = 'missing';
        return copy;
      },
      message: 'frontend production owner does not resolve',
    },
    {
      name: 'domains on a non-frontend app',
      mutate: (copy: typeof manifest) => {
        const frontend = structuredClone(copy.apps[0]);
        frontend.id = 'other';
        frontend.name = 'other';
        frontend.domains = [];
        copy.apps.push(frontend);
        copy.deploymentAuthority.frontendProductionOwner.app = 'other';
        return copy;
      },
      message: 'Exactly the frontend production owner app must declare domains',
    },
    {
      name: 'no frontend ingress',
      mutate: (copy: typeof manifest) => {
        copy.apps[0].ingress = [];
        return copy;
      },
      message: 'must own a declared ingress route',
    },
    {
      name: 'a mismatched Convex build command',
      mutate: (copy: typeof manifest) => {
        copy.deploymentAuthority.convexProductionOwner.buildCommand =
          'pnpm convex deploy';
        return copy;
      },
      message: 'build command must match its service',
    },
    {
      name: 'multiple Convex build-command owners',
      mutate: (copy: typeof manifest) => {
        const duplicateOwner = structuredClone(copy.apps[0]);
        duplicateOwner.id = 'other';
        duplicateOwner.name = 'other';
        duplicateOwner.domains = [];
        duplicateOwner.ingress = [];
        copy.apps.push(duplicateOwner);
        return copy;
      },
      message: 'Exactly one declared service must own the Convex production',
    },
  ])('rejects $name', ({ mutate, message }) => {
    expect(() =>
      validateDigitalOceanAppManifest(mutate(manifestCopy()))
    ).toThrow(message);
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

  it('fails closed on a populated non-array live surface', () => {
    const live = liveApp();
    Object.assign(live.spec, { databases: { name: 'unexpected' } });

    expect(() => normalizeDigitalOceanApp(live)).toThrow(
      'unsupported live field spec.databases'
    );
  });

  it.each([
    [null, 'DigitalOcean app readback must be an object'],
    [{}, 'DigitalOcean app spec must be an object'],
  ])('rejects malformed live app readback %#', (readback, message) => {
    expect(() => normalizeDigitalOceanApp(readback)).toThrow(message);
  });

  it('normalizes omitted optional provider collections and commands', () => {
    const live = liveApp();
    Reflect.deleteProperty(live.spec, 'features');
    Reflect.deleteProperty(live.spec, 'domains');
    Reflect.deleteProperty(live.spec, 'ingress');
    Reflect.deleteProperty(live.spec.services[0], 'build_command');
    Reflect.deleteProperty(live.spec.services[0], 'run_command');
    Reflect.deleteProperty(live.spec.services[0], 'envs');

    const normalized = normalizeDigitalOceanApp(live);

    expect(normalized.features).toEqual([]);
    expect(normalized.domains).toEqual([]);
    expect(normalized.ingress).toEqual([]);
    expect(normalized.services[0]).not.toHaveProperty('buildCommand');
    expect(normalized.services[0]).not.toHaveProperty('runCommand');
    expect(normalized.services[0].environment).toEqual([]);
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

  it('fails when a declared source app is missing from inventory', () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: '[]',
      stderr: '',
    });

    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner,
        logger: { log: vi.fn() },
      })
    ).toThrow(
      'DigitalOcean source-app drift: missing=linejam; unexpected=none'
    );
  });

  it('reports normalized live drift by app path', () => {
    const drifted = liveApp();
    drifted.spec.services[0].instance_count = 2;
    const runner = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify([liveApp()]) })
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify([drifted]) });

    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner,
        logger: { log: vi.fn() },
      })
    ).toThrow(
      'DigitalOcean app drift: apps.linejam.services.web.instanceCount'
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

  it('fails closed when the provider process cannot start', () => {
    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner: vi.fn().mockReturnValue({
          status: null,
          error: Object.assign(new Error('must-not-replay'), {
            code: 'ENOENT',
          }),
        }),
        logger: { log: vi.fn() },
      })
    ).toThrow('DigitalOcean app inventory provider read failed to start');
  });

  it('reports an unknown provider status without replaying output', () => {
    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner: vi.fn().mockReturnValue({ status: null }),
        logger: { log: vi.fn() },
      })
    ).toThrow('provider read failed with status unknown');
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

  it('rejects non-array inventory JSON', () => {
    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner: vi.fn().mockReturnValue({ status: 0, stdout: '{}' }),
        logger: { log: vi.fn() },
      })
    ).toThrow('app inventory returned an unexpected shape');
  });

  it.each([
    ['{', 'provider read returned invalid JSON'],
    ['[]', 'provider read returned an unexpected app shape'],
  ])('rejects malformed exact app readback %#', (stdout, message) => {
    const runner = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stdout: JSON.stringify([liveApp()]) })
      .mockReturnValueOnce({ status: 0, stdout });

    expect(() =>
      runDigitalOceanDriftCheck({
        manifest,
        runner,
        logger: { log: vi.fn() },
      })
    ).toThrow(message);
  });
});
