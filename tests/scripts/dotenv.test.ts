import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { loadDotenvFile, parseDotenv } from '@/scripts/ci/dotenv.mjs';

describe('parseDotenv', () => {
  it('ignores comments and parses unquoted values', () => {
    expect(
      Object.fromEntries(
        parseDotenv(
          [
            '# comment',
            'FOO=bar',
            'BAR=baz # note',
            'BAZ=qux#still-value',
          ].join('\n')
        )
      )
    ).toEqual({
      FOO: 'bar',
      BAR: 'baz',
      BAZ: 'qux#still-value',
    });
  });

  it('parses quoted values with trailing comments', () => {
    expect(
      Object.fromEntries(
        parseDotenv(
          [
            'DOUBLE="bar baz" # note',
            "SINGLE='zip zap' # note",
            'SPACED="  keep me  " # trailing',
          ].join('\n')
        )
      )
    ).toEqual({
      DOUBLE: 'bar baz',
      SINGLE: 'zip zap',
      SPACED: '  keep me  ',
    });
  });

  it('preserves escaped characters in double-quoted values', () => {
    expect(
      Object.fromEntries(
        parseDotenv(
          [
            'PATH_VALUE="C:\\\\temp\\\\folder"',
            'MULTILINE="line 1\\nline 2"',
            'QUOTED="quote \\"x\\""',
          ].join('\n')
        )
      )
    ).toEqual({
      PATH_VALUE: 'C:\\temp\\folder',
      MULTILINE: 'line 1\nline 2',
      QUOTED: 'quote "x"',
    });
  });

  it('supports export-prefixed entries', () => {
    expect(parseDotenv('export FOO=bar')).toEqual([['FOO', 'bar']]);
  });

  it('throws on trailing content after quoted values', () => {
    expect(() => parseDotenv('BROKEN="value" nope')).toThrow(
      'Invalid trailing content after quoted value on line 1'
    );
  });

  it('throws on dangling double-quoted escapes', () => {
    expect(() => parseDotenv('BROKEN="value\\')).toThrow(
      'Invalid escape sequence on line 1'
    );
  });
});

describe('loadDotenvFile', () => {
  it('preserves quoted values from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'linejam-dotenv-'));
    const file = join(dir, '.env');

    try {
      writeFileSync(
        file,
        'TOKEN=" value with spaces " # comment\nSECRET=sk_live_example\n'
      );

      expect(Object.fromEntries(loadDotenvFile(file))).toEqual({
        TOKEN: ' value with spaces ',
        SECRET: 'sk_live_example',
      });
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('throws on malformed quoted values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'linejam-dotenv-'));
    const file = join(dir, '.env');

    try {
      writeFileSync(file, 'BROKEN="unterminated\n');

      expect(() => loadDotenvFile(file)).toThrow(
        'Unterminated quoted value on line 1'
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
