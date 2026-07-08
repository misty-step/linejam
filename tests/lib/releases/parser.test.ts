import { describe, expect, it } from 'vitest';

import { findRelease, parseChangelog } from '@/lib/releases/parser';

describe('parseChangelog', () => {
  it('parses semantic-release headings and markdown references separately', () => {
    const releases = parseChangelog(`# Changelog

## [1.15.1](https://github.com/misty-step/linejam/compare/v1.15.0...v1.15.1) (2026-07-04)

### Bug Fixes

* **convex:** bound launch reads and live game failures ([#294](https://github.com/misty-step/linejam/issues/294)) ([c80e449](https://github.com/misty-step/linejam/commit/c80e449738eb774352f5214d5ef01493cfc3a885))

# [1.15.0](https://github.com/misty-step/linejam/compare/v1.14.0...v1.15.0) (2026-07-03)

### Features

* make reveal shareable and teach first writers ([#292](https://github.com/misty-step/linejam/issues/292)) ([f931819](https://github.com/misty-step/linejam/commit/f93181982cfe55d7dad834a38c2395c135b9eef9))
`);

    expect(releases).toEqual([
      {
        version: '1.15.1',
        date: '2026-07-04',
        changes: [
          {
            type: 'fix',
            scope: 'convex',
            description: 'bound launch reads and live game failures',
            breaking: false,
            pr: 294,
            commit: 'c80e449',
          },
        ],
      },
      {
        version: '1.15.0',
        date: '2026-07-03',
        changes: [
          {
            type: 'feat',
            description: 'make reveal shareable and teach first writers',
            breaking: false,
            pr: 292,
            commit: 'f931819',
          },
        ],
      },
    ]);
  });

  it('keeps legacy changelog headings and filters unreleased entries', () => {
    const releases = parseChangelog(`## [Unreleased]

### Added

- feat(lobby)!: experimental lobby controls

## [2.0.0] - 2026-07-08

### Added

- feat(host)!: add present mode
- **BREAKING** remove legacy quick mode
- [reveal] show the final poem to guests

### Performance

- speed up reveal rendering (abc1234)
`);

    expect(releases).toEqual([
      {
        version: '2.0.0',
        date: '2026-07-08',
        changes: [
          {
            type: 'feat',
            scope: 'host',
            description: 'add present mode',
            breaking: true,
          },
          {
            type: 'feat',
            description: 'remove legacy quick mode',
            breaking: true,
          },
          {
            type: 'feat',
            scope: 'reveal',
            description: 'show the final poem to guests',
            breaking: false,
          },
          {
            type: 'perf',
            description: 'speed up reveal rendering',
            breaking: false,
            commit: 'abc1234',
          },
        ],
      },
    ]);

    expect(findRelease(releases, 'v2.0.0')?.version).toBe('2.0.0');
    expect(findRelease(releases, '1.0.0')).toBeUndefined();
  });
});
