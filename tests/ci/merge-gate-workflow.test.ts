import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('merge-gate workflow', () => {
  it('runs the live throttle probe only for trusted repository events', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const probeStep = workflow.match(
      /- name: Verify signed guest throttle is deployed[\s\S]*?run: node scripts\/convex\/probe-signed-throttle-ready\.mjs/
    )?.[0];

    expect(probeStep).toContain("github.event_name == 'push'");
    expect(probeStep).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository'
    );
  });
});
