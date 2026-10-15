/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = { name: string; run?: string; if?: string };
const workflow = parse(
  readFileSync('.github/workflows/convex-backup.yml', 'utf8')
);
const steps: Step[] = workflow.jobs.backup.steps;
function runStep(name: string, key = '') {
  const step = steps.find((candidate) => candidate.name === name);
  if (!step?.run) throw new Error(`Missing shell step: ${name}`);
  return spawnSync('bash', ['-c', step.run], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, CONVEX_DEPLOY_KEY_PROD: key },
  });
}

describe('Convex backup safety', () => {
  it('refuses export without the production key', () => {
    const result = runStep('Require production deploy key');
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe(
      '::error::CONVEX_DEPLOY_KEY_PROD is required; refusing to export a production Convex backup.'
    );
  });

  it('accepts a present key without logging its value', () => {
    const result = runStep(
      'Require production deploy key',
      'synthetic-test-key'
    );
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toBe('');
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
