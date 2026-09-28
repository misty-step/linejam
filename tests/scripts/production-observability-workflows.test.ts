/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: { ref?: string; 'persist-credentials'?: boolean };
  'continue-on-error'?: boolean;
};
type Job = {
  name: string;
  needs?: string | string[];
  if?: string;
  env?: Record<string, string>;
  steps: Step[];
  'continue-on-error'?: boolean;
};
type Workflow = {
  on: {
    workflow_run?: { workflows: string[]; types: string[]; branches: string[] };
  };
  jobs: Record<string, Job>;
};

function workflow(name: string): Workflow {
  // The YAML is the GitHub Actions execution contract, not implementation text.
  return parse(readFileSync(`.github/workflows/${name}`, 'utf8'));
}

describe('production health and observability ownership (MIS-174)', () => {
  it('cannot make the player job depend on a Sentry write or reporting result', () => {
    const { jobs } = workflow('prod-smoke.yml');
    const player = jobs.smoke;
    expect(player.name).toBe('Production Smoke');
    expect(player.needs).toBeUndefined();
    expect(player['continue-on-error']).not.toBe(true);
    const browser = player.steps.find(
      (step) => step.name === 'Run production smoke'
    );
    expect(browser).toMatchObject({
      id: 'smoke',
      run: expect.stringContaining('pnpm smoke:run'),
    });
    expect(browser?.['continue-on-error']).not.toBe(true);
    for (const step of player.steps) {
      expect(step.run ?? '').not.toMatch(
        /(?:record-sentry-deploy|report-sentry-check-in)\.mjs/
      );
    }
    expect(jobs.reporting.needs).toBe('smoke');
    expect(jobs.reporting['continue-on-error']).not.toBe(true);
    expect(
      jobs.reporting.steps.find(
        (step) => step.name === 'Report status to Sentry'
      )
    ).toMatchObject({ run: 'node scripts/ops/report-sentry-check-in.mjs' });
  });

  it('keeps deploy-marker failures hard and independently routable on master', () => {
    const smoke = workflow('prod-smoke.yml');
    const bookkeeping = workflow('prod-sentry-bookkeeping.yml');
    expect(bookkeeping.on.workflow_run).toEqual({
      workflows: ['Production Smoke'],
      types: ['completed'],
      branches: ['master'],
    });
    const markerCommand = 'node scripts/ops/record-sentry-deploy.mjs';
    expect(
      Object.values(smoke.jobs)
        .flatMap((job) => job.steps)
        .some((step) => step.run?.includes('record-sentry-deploy.mjs'))
    ).toBe(false);
    const job = bookkeeping.jobs.bookkeeping;
    expect(job.needs).toBeUndefined();
    expect(job['continue-on-error']).not.toBe(true);
    expect(job.if).not.toContain('conclusion');
    const marker = job.steps.find((step) => step.run === markerCommand);
    expect(marker).toBeDefined();
    expect(marker?.['continue-on-error']).not.toBe(true);
    expect(marker?.env?.SENTRY_AUTH_TOKEN).toBe(
      '${{ secrets.SENTRY_RELEASE_TOKEN }}'
    );
    // workflow_run must never execute code or artifacts from its privileged trigger.
    expect(
      job.steps.find((step) => step.uses?.startsWith('actions/checkout@'))?.with
    ).toMatchObject({ ref: 'master', 'persist-credentials': false });
    expect(
      job.steps.some((step) =>
        step.uses?.startsWith('actions/download-artifact@')
      )
    ).toBe(false);
  });
});
