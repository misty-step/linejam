/** @vitest-environment node */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = {
  name?: string;
  id?: string;
  if?: string;
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
    expect(jobs.reporting['continue-on-error']).toBe(true);
    expect(
      jobs.reporting.steps.find(
        (step) => step.name === 'Report status to Sentry'
      )
    ).toMatchObject({ run: 'node scripts/ops/report-sentry-check-in.mjs' });
    expect(
      player.steps.find(
        (step) => step.name === 'Resolve deployed Sentry release'
      )
    ).toMatchObject({ 'continue-on-error': true });
    expect(
      player.steps.find(
        (step) => step.name === 'Enforce deployed release attribution'
      )
    ).toBeUndefined();
    const attribution = jobs.reporting.steps.find(
      (step) => step.name === 'Enforce deployed release attribution'
    );
    expect(attribution).toMatchObject({
      if: "always() && needs.smoke.outputs.release_outcome != 'success'",
    });
    expect(attribution?.['continue-on-error']).not.toBe(true);
  });

  it('attempts deploy markers on master without making provider failure fatal', () => {
    const smoke = workflow('prod-smoke.yml');
    const bookkeeping = workflow('prod-sentry-bookkeeping.yml');
    expect(bookkeeping.on).toEqual({
      workflow_run: {
        workflows: ['Production Smoke'],
        types: ['completed'],
        branches: ['master'],
      },
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
    expect(job.if).toContain("github.ref == 'refs/heads/master'");
    const marker = job.steps.find((step) => step.run === markerCommand);
    expect(marker).toMatchObject({ id: 'marker', 'continue-on-error': true });
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

  it.each(['success', 'failure', 'skipped'])(
    'surfaces the actual %s marker outcome instead of its tolerated conclusion',
    (outcome) => {
      const summary = workflow(
        'prod-sentry-bookkeeping.yml'
      ).jobs.bookkeeping.steps.find(
        (step) => step.name === 'Summarize bookkeeping'
      );
      expect(summary).toMatchObject({
        if: 'always()',
        env: { MARKER_OUTCOME: '${{ steps.marker.outcome }}' },
      });
      const result = spawnSync('bash', ['-e', '-c', summary!.run!], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_STEP_SUMMARY: '/dev/null',
          BOOKKEEPING_STATUS: 'success',
          MARKER_OUTCOME: outcome,
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.includes('::warning::')).toBe(outcome !== 'success');
    }
  );
});
