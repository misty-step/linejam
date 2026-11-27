import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROUND_WORDS,
  checkLine,
  countWords,
  isRoomCode,
  normalizeCode,
  normalizeLine,
  poemForSeat,
  readerSeat,
  writerSeat,
} from '../../shared/rules.ts';
import { root } from './helpers.ts';

const read = (path: string) => readFileSync(join(root, path), 'utf8');
const css = read('web/static/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = JSON.parse(read('folio/assets/tokens.json'));
const clientSource = readdirSync(join(root, 'web/src'))
  .filter((file) => file.endsWith('.ts'))
  .map((file) => read(`web/src/${file}`))
  .join('\n');

describe('[L1-1] shared rules', () => {
  it('counts whitespace-separated words and normalizes pasted whitespace', () => {
    expect(countWords('  well,\t then...\n')).toBe(2);
    expect(countWords("don't-stop")).toBe(1);
    expect(countWords('   ')).toBe(0);
    expect(normalizeLine(' a\t\tb \n c ')).toBe('a b c');
    expect(checkLine('one two', 0)).toEqual({ code: 'wrong_word_count', message: 'Use 1 word' });
    expect(checkLine('one two three', 2)).toBeNull();
    expect(checkLine(`${'x'.repeat(500)}`, 0)).toBeNull();
    expect(checkLine(`${'x'.repeat(501)}`, 0)?.code).toBe('line_too_long');
  });

  it('normalizes typed room codes and refuses 0, 1, O and I', () => {
    expect(normalizeCode(' ab-2c ')).toBe('AB2C');
    expect(isRoomCode('AB2C')).toBe(true);
    for (const bad of ['AB0C', 'AB1C', 'ABOC', 'ABIC', 'ABC', 'ABCDE']) expect(isRoomCode(bad)).toBe(false);
  });

  it('builds the 9-round pass-the-poem matrix for 2 to 8 writers', () => {
    expect([...ROUND_WORDS]).toEqual([1, 2, 3, 4, 5, 4, 3, 2, 1]);
    for (let writers = 2; writers <= 8; writers++) {
      for (let round = 0; round < 9; round++) {
        // Every round is a permutation: each writer on exactly one poem.
        const seats = Array.from({ length: writers }, (_, poem) => writerSeat(poem, round, writers));
        expect(new Set(seats).size).toBe(writers);
        for (let seat = 0; seat < writers; seat++)
          expect(writerSeat(poemForSeat(seat, round, writers), round, writers)).toBe(seat);
      }
      for (let poem = 0; poem < writers; poem++) {
        const authors = Array.from({ length: 9 }, (_, round) => writerSeat(poem, round, writers));
        // A poem passes on every round: no writer writes two consecutive lines of it.
        for (let round = 1; round < 9; round++) expect(authors[round]).not.toBe(authors[round - 1]);
        // Everyone writes on every poem.
        expect(new Set(authors).size).toBe(writers);
        // The reader did not start the poem.
        expect(readerSeat(poem, writers)).not.toBe(writerSeat(poem, 0, writers));
      }
    }
  });
});

describe('[D1-1] [D1-2.5] [D1-6] the stylesheet uses tokens only', () => {
  it('contains no color literal: every color is a token', () => {
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
    expect(css.match(/\b(rgb|rgba|hsl|hsla|oklch|color-mix)\(/g)).toBeNull();
  });

  it('uses only the token radii, type stacks and motion durations', () => {
    for (const value of css.match(/border-radius:\s*[^;]+;/g) ?? [])
      expect(value).toMatch(/var\(--radius-(sheet|control|tag)\)/);
    for (const value of css.match(/font-family:\s*[^;]+;/g) ?? [])
      expect(value).toMatch(/var\(--font-(serif|sans|mono)\)|inherit/);
    // 120ms is the reduced-motion crossfade ceiling in DESIGN.md [D1-6.3]; everything else is a token.
    const durations = (css.match(/\b\d+(\.\d+)?m?s\b/g) ?? []).filter((d) => d !== '120ms');
    expect(durations).toEqual([]);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('animates only transform, opacity and color', () => {
    const transitions = (css.match(/transition(-property)?:[^;]+;/g) ?? []).join(' ');
    const properties = new Set(
      transitions.match(
        /\b(transform|opacity|color|background-color|border-color|all|width|height|margin|padding|top|left|box-shadow|outline[a-z-]*)\b/g
      )
    );
    for (const property of properties)
      expect(['transform', 'opacity', 'color', 'background-color', 'border-color']).toContain(property);
    for (const frames of css.match(/@keyframes[^{]+\{([^{}]*\{[^{}]*\})+/g) ?? []) {
      for (const declaration of frames.match(/[a-z-]+(?=:\s)/g) ?? [])
        expect(['opacity', 'transform']).toContain(declaration);
    }
  });

  it('has none of the banned devices', () => {
    expect(css).not.toMatch(/backdrop-filter|999px|9999px|text-shadow|gradient\(|filter:/);
    expect(css).not.toMatch(/Inter|DynaPuff|Nunito/);
    // One soft shadow, on floating layers only: the menu and the dialog.
    const shadows = css.match(/[^{}]+\{[^{}]*box-shadow:[^;]+;/g) ?? [];
    expect(shadows).toHaveLength(2);
    for (const rule of shadows) {
      expect(rule).toMatch(/^\s*\.(menu|dialog)\s*\{/);
      expect(rule).toContain('box-shadow: var(--shadow-float)');
    }
  });

  it('keeps theme-color in step with the token canvas colors', () => {
    const html = read('web/static/index.html');
    expect(html).toContain(`content="${tokens.light.bg}" media="(prefers-color-scheme: light)"`);
    expect(html).toContain(`content="${tokens.dark.bg}" media="(prefers-color-scheme: dark)"`);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<style|style=|onclick=|<script>(?!<)/);
  });
});

describe('[L1-7.2] [D1-5] zero narrator copy', () => {
  it('uses the canonical labels', () => {
    for (const label of [
      'Pen name',
      'Emblem',
      'New room',
      'Room code',
      'Join',
      'Share invite',
      'Start game',
      'Previous',
      'Tuck line',
      'Line tucked',
      'Next poem',
      'Play again',
    ]) {
      expect(clientSource, label).toContain(label);
    }
    expect(clientSource).toContain('Anyone with this link can read this poem');
  });

  it('has none of the forbidden patterns, no sign-in clutter and no emoji', () => {
    expect(clientSource).not.toMatch(
      /the only line you get to see|click below|tap below|welcome to|let's|get started|simply|just enter/i
    );
    expect(clientSource).not.toMatch(/sign in|sign up|log in/i);
    expect(clientSource).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(clientSource).not.toMatch(/countdown|setInterval\([^)]*1000|seconds left/i);
  });
});

describe('[L1-5] one runtime', () => {
  it('has no trace of the retired stack', () => {
    for (const gone of [
      'app',
      'components',
      'convex',
      'crates',
      'dagger',
      'site',
      'vendor',
      'Cargo.toml',
      'Cargo.lock',
      'rust-toolchain.toml',
      'next.config.ts',
      'open-next.config.ts',
      'middleware.ts',
      'dagger.json',
    ]) {
      expect(existsSync(join(root, gone)), gone).toBe(false);
    }
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.dependencies ?? {}).toEqual({});
    const dev = Object.keys(pkg.devDependencies);
    for (const name of dev)
      expect(name).not.toMatch(/^(next|react|react-dom|convex|@opennextjs|@clerk|@sentry|tailwindcss|@dagger\.io)/);
    const wrangler = read('wrangler.jsonc');
    expect(wrangler).toContain('"main": "src/worker.ts"');
    expect(wrangler).toMatch(/"new_sqlite_classes": \["RoomDO", "ArchiveDO"\]/);
    expect(wrangler).not.toMatch(/open-next|convex|nodejs_compat/i);
  });

  // Sentry issue 7795445353: the recompile deleted the code that fed Sentry cron
  // monitors, but the monitors stayed live and alerted on every missed minute.
  it('feeds no cron monitor, and names every retired one for removal', () => {
    const wrangler = read('wrangler.jsonc');
    expect(wrangler).not.toMatch(/"triggers"\s*:|"crons"\s*:/);
    const workerSource = readdirSync(join(root, 'src'))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => read(`src/${file}`))
      .join('\n');
    expect(workerSource).not.toMatch(/\bscheduled\s*\(|ScheduledController/);
    expect(workerSource).not.toMatch(/sentry|check_in|monitor_slug/i);
    const operations = read('docs/operations.md');
    const monitoring = operations.slice(
      operations.indexOf('## Monitoring'),
      operations.indexOf('## The legacy data object')
    );
    for (const slug of ['linejam-abandonment-sweep', 'linejam-production-smoke', 'linejam-convex-backup']) {
      expect(monitoring, slug).toContain(`\`${slug}\``);
    }
    expect(existsSync(join(root, '.github/workflows/health-monitor.yml'))).toBe(true);
    expect(read('.github/workflows/health-monitor.yml')).toContain('https://linejam.mistystep.io/api/health');
  });
});
