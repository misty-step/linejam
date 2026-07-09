import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');

describe('Pages workflow', () => {
  it('installs pnpm before setup-node asks for the pnpm cache', () => {
    const pnpmSetup = workflow.indexOf('uses: pnpm/action-setup@');
    const nodeSetup = workflow.indexOf('uses: actions/setup-node@');

    expect(pnpmSetup).toBeGreaterThan(-1);
    expect(nodeSetup).toBeGreaterThan(pnpmSetup);
    expect(workflow.slice(nodeSetup)).toContain('cache: pnpm');
  });

  it('keeps push, successful Release, and manual deployment triggers', () => {
    expect(workflow).toContain('push:');
    expect(workflow).toContain('workflows: [Release]');
    expect(workflow).toContain(
      "github.event.workflow_run.conclusion == 'success'"
    );
    expect(workflow).toContain('workflow_dispatch:');
  });
});
