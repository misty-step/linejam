/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = {
  name: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
};
const workflow = parse(
  readFileSync('.github/workflows/convex-backup.yml', 'utf8')
);
const steps: Step[] = workflow.jobs.backup.steps;
function runStep(
  name: string,
  {
    key = '',
    env = {},
    cwd,
  }: { key?: string; env?: Record<string, string>; cwd?: string } = {}
) {
  const step = steps.find((candidate) => candidate.name === name);
  if (!step?.run) throw new Error(`Missing shell step: ${name}`);
  return spawnSync('bash', ['-c', step.run], {
    encoding: 'utf8',
    cwd,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      CONVEX_DEPLOY_KEY_PROD: key,
      ...env,
    },
  });
}

describe('Convex backup safety', () => {
  it('refuses export without the production key', () => {
    const result = runStep('Require production export credential');
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe(
      '::error::CONVEX_DEPLOY_KEY_PROD is required; refusing to export a production Convex backup.'
    );
  });

  it('accepts a present key without logging its value', () => {
    const result = runStep('Require production export credential', {
      key: 'synthetic-test-key',
    });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toBe('');
  });

  it('binds guard and export to the same required Actions secret', () => {
    for (const name of [
      'Require production export credential',
      'Export production Convex data',
    ]) {
      expect(steps.find((step) => step.name === name)?.env).toEqual({
        CONVEX_DEPLOY_KEY_PROD: '${{ secrets.CONVEX_DEPLOY_KEY_PROD }}',
      });
    }
    expect(
      steps.findIndex(
        (step) => step.name === 'Require production export credential'
      )
    ).toBeLessThan(
      steps.findIndex((step) => step.name === 'Export production Convex data')
    );
  });

  it('exports only the explicit production target with the approved access token', () => {
    const directory = mkdtempSync(join(tmpdir(), 'linejam-backup-consumer-'));
    const ambient = {
      CONVEX_DEPLOY_KEY: 'prod:wrong-key',
      CONVEX_DEPLOYMENT_TOKEN: 'prod:wrong-token',
      CONVEX_DEPLOYMENT: 'prod:wrong-deployment',
      CONVEX_DEPLOYMENT_URL: 'https://wrong.convex.cloud',
      CONVEX_SELF_HOSTED_URL: 'http://127.0.0.1:9999',
      CONVEX_SELF_HOSTED_ADMIN_KEY: 'wrong-admin-key',
    };
    try {
      // A command-boundary double, not a real export or permission check.
      writeFileSync(
        join(directory, 'pnpm'),
        `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  args: process.argv.slice(2),
  token: process.env.CONVEX_OVERRIDE_ACCESS_TOKEN,
  ambient: Object.fromEntries(${JSON.stringify(Object.keys(ambient))}
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]])),
}));
`,
        { mode: 0o700 }
      );
      const result = runStep('Export production Convex data', {
        key: 'synthetic-approved-token',
        cwd: directory,
        env: {
          ...ambient,
          CONVEX_OVERRIDE_ACCESS_TOKEN: 'wrong-access-token',
          PATH: `${directory}:${process.env.PATH}`,
        },
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        args: [
          'exec',
          'convex',
          'export',
          '--env-file',
          '/dev/null',
          '--deployment',
          'amiable-bulldog-848',
          '--path',
          'linejam-convex-export.zip',
        ],
        token: 'synthetic-approved-token',
        ambient: {},
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('makes the opt-in alarm drill fail before export', () => {
    expect(workflow.on.workflow_dispatch.inputs.failure_drill.default).toBe(
      false
    );
    const drillIndex = steps.findIndex(
      (step) => step.name === 'Exercise backup failure alarm'
    );
    expect(steps[drillIndex].if).toBe('${{ inputs.failure_drill == true }}');
    expect(drillIndex).toBeLessThan(
      steps.findIndex((step) => step.name === 'Export production Convex data')
    );
    const result = runStep('Exercise backup failure alarm');
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe(
      '::error::Intentional Convex backup failure drill; no export or production mutation attempted.'
    );
  });
});
