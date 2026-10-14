/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { liveStoriesFromSpec } from '@/qa/spec-stories.mjs';

const story = (id: string, status = 'live') =>
  `### ${id} [${status}] Observable story\n\n1. WHEN we act, THE SYSTEM SHALL show the result.\n`;
const spec = (body: string) => `# Linejam\n\n## Capability: Party\n\n${body}`;

describe('canonical SPEC story selection', () => {
  it('selects only live stories, preserving IDs and numbered checkpoints', () => {
    const source = spec(
      story('US-001') +
        story('US-002', 'next') +
        story('US-1000', 'later') +
        '## Capability: Archive\n' +
        story('US-005')
    );
    expect([...liveStoriesFromSpec(source)]).toEqual([
      ['US-001', [1]],
      ['US-005', [1]],
    ]);
  });

  it('bounds criteria at the next story or capability, not a detail subheading', () => {
    const source = spec(
      story('US-001') +
        '\n#### Details\n2. IF disconnected, THE SYSTEM SHALL recover.\n' +
        '## Capability: Future\n1. WHEN unrelated, THE SYSTEM SHALL wait.\n' +
        story('US-002', 'later')
    );
    expect([...liveStoriesFromSpec(source)]).toEqual([['US-001', [1, 2]]]);
  });

  it('does not retire a live story because acceptance mentions retired invitations', () => {
    expect([
      ...liveStoriesFromSpec(
        spec(story('US-001') + '\nRetired invitations stay closed.')
      ),
    ]).toEqual([['US-001', [1]]]);
  });

  it.each([
    '',
    '# Linejam\n',
    spec(story('US-001', 'next')),
    spec('## US-001 Legacy heading\n1. WHEN acting, THE SYSTEM SHALL work.\n'),
    spec(story('US-001', 'unknown')),
    story('US-001'),
    spec(story('US-001') + story('US-001', 'later')),
    spec('### US-001 [live] Empty criteria\n'),
    spec(story('US-001') + '3. WHEN acting, THE SYSTEM SHALL work.\n'),
    spec(story('US-001') + '1. WHEN acting, THE SYSTEM SHALL work.\n'),
  ])(
    'rejects missing, malformed, duplicate or vacuous catalogs: %s',
    (source) => {
      expect(() => liveStoriesFromSpec(source)).toThrow(/SPEC.md/);
    }
  );

  it('reads the real specification and preserves the existing walk contract', () => {
    const source = readFileSync('SPEC.md', 'utf8');
    expect([...liveStoriesFromSpec(source)]).toEqual([
      ['US-001', [1, 2, 3]],
      ['US-002', [1, 2, 3]],
      ['US-003', [1, 2, 3]],
      ['US-004', [1, 2, 3, 4, 5, 6]],
    ]);
    const reference = readFileSync('USER_STORIES.md', 'utf8');
    expect(reference).toContain('[SPEC.md](SPEC.md)');
    expect(() => liveStoriesFromSpec(reference)).toThrow(/no live stories/);
  });

  it('lists canonical live stories through the real CLI without starting a runtime', () => {
    const result = spawnSync(process.execPath, ['qa/walk', '--list'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('US-001\nUS-002\nUS-003\nUS-004\n');
    expect(result.stderr).toBe('');
  });

  it('rejects an unknown selection before starting a runtime or issuing a pass', () => {
    const result = spawnSync(
      process.execPath,
      ['qa/walk', '--stories', 'US-999'],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('no pass receipt was issued');
  });
});
