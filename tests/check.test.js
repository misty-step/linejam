import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkPlan,
  isolatedEnvironment,
  runChecks,
  sourceRevision,
} from '../scripts/check.mjs';

const directories = [];
const packageManager = JSON.parse(
  readFileSync('package.json', 'utf8')
).packageManager;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'linejam-native-check-'));
  directories.push(root);
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'native-check-process-fixture',
      private: true,
      packageManager,
      scripts: Object.fromEntries(
        checkPlan('full')
          .concat('test')
          .map((command) => {
            const name = command.split(' ')[0];
            return [name, `node task.mjs ${name}`];
          })
      ),
    })
  );
  // Real pnpm/Node processes test orchestration, not application acceptance.
  writeFileSync(
    join(root, 'task.mjs'),
    `import { appendFileSync, writeFileSync } from 'node:fs';
appendFileSync('calls', process.argv.slice(2).join(' ') + '\\n');
writeFileSync('environment.json', JSON.stringify({
  local: process.env.LINEJAM_LOCAL,
  backend: process.env.NEXT_PUBLIC_CONVEX_URL,
  clerk: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  analytics: process.env.NEXT_PUBLIC_POSTHOG_KEY,
}));
if (process.env.FAIL_CHECK === process.argv[2]) process.exit(7);
`
  );
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Local check',
      '-c',
      'user.email=check@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ],
    { cwd: root }
  );
  const env = Object.fromEntries(
    [
      'PATH',
      'HOME',
      'TMPDIR',
      'PNPM_HOME',
      'COREPACK_HOME',
      'COREPACK_ENABLE_NETWORK',
    ]
      .filter((name) => process.env[name])
      .map((name) => [name, process.env[name]])
  );
  return {
    root,
    env,
    calls: () => readFileSync(join(root, 'calls'), 'utf8').trim().split('\n'),
  };
}

afterEach(() => {
  for (const root of directories.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe('portable native checks', () => {
  it('keeps fast cheap and full on the accepted Worker/DO path, without live mirrors', () => {
    expect(checkPlan('fast')).toEqual([
      'test:train',
      'test:rust',
      'provider-retirement:check',
      'typecheck',
      'lint',
      'test',
    ]);
    expect(checkPlan('full')).toContain('test:ci');
    expect(checkPlan('full').slice(-4)).toEqual([
      'build:cf',
      'test:worker-routes',
      'test:worker-images',
      'test:worker-routes --game',
    ]);
    expect(() => checkPlan('unknown')).toThrow('Expected --mode fast or full');
  });

  it.each([
    'CONVEX_DEPLOY_KEY',
    'CONVEX_DEPLOY_KEY_PROD',
    'CONVEX_OVERRIDE_ACCESS_TOKEN',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
    'CLERK_SECRET_KEY',
    'CLOUDFLARE_API_TOKEN',
    'SENTRY_AUTH_TOKEN',
    'SENTRY_RELEASE_TOKEN',
    'OPENROUTER_API_KEY',
    'GUEST_TOKEN_SECRET',
    'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    'LINEJAM_BACKEND_ADMIN_KEY',
    'CONVEX_DEPLOYMENT',
  ])('rejects %s without replaying its value', (name) => {
    expect(() =>
      isolatedEnvironment({ [name]: 'private-canary' }, 'a'.repeat(40))
    ).toThrow(`Isolated checks refuse ${name}.`);
  });

  it('executes full commands through real pnpm with a local, uninstrumented artifact environment', () => {
    const f = fixture();
    runChecks(f.root, 'full', f.env);
    expect(f.calls()).toEqual(checkPlan('full'));
    expect(
      JSON.parse(readFileSync(join(f.root, 'environment.json'), 'utf8'))
    ).toEqual({
      local: '1',
      backend: 'http://127.0.0.1:8787/backend',
      clerk: '',
      analytics: '',
    });
  }, 30000);

  it('stops after a rejected process and permits an ordinary recovery run', () => {
    const f = fixture();
    expect(() =>
      runChecks(f.root, 'fast', { ...f.env, FAIL_CHECK: 'lint' })
    ).toThrow('pnpm lint failed');
    expect(f.calls()).toEqual([
      'test:train',
      'test:rust',
      'provider-retirement:check',
      'typecheck',
      'lint',
    ]);
    writeFileSync(join(f.root, 'calls'), '');
    runChecks(f.root, 'fast', f.env);
    expect(f.calls()).toEqual(checkPlan('fast'));
    expect(
      JSON.parse(readFileSync(join(f.root, 'environment.json'), 'utf8'))
    ).not.toHaveProperty('local');
  }, 30000);

  it('refuses credentials before executing any command', () => {
    const f = fixture();
    expect(() =>
      runChecks(f.root, 'fast', {
        ...f.env,
        CLOUDFLARE_API_TOKEN: 'private-canary',
      })
    ).toThrow('refuse CLOUDFLARE_API_TOKEN');
    expect(() => f.calls()).toThrow();
  });

  it('retains the actual checkout revision without inventing an archive revision', () => {
    const f = fixture();
    expect(sourceRevision(f.root)).toBe(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: f.root,
        encoding: 'utf8',
      }).trim()
    );
    rmSync(join(f.root, '.git'), { recursive: true });
    expect(sourceRevision(f.root)).toBeNull();
  });

  it.each(['fast', 'full'])(
    'keeps the Git-free source-archive %s checker working',
    (mode) => {
      const f = fixture();
      rmSync(join(f.root, '.git'), { recursive: true });
      runChecks(f.root, mode, f.env);
      expect(f.calls()).toEqual(checkPlan(mode));
    },
    30000
  );

  it.each([
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
    '.env.test',
    '.dev.vars',
    '.dev.vars.production',
  ])('rejects dotenv discovery through %s before any subprocess', (name) => {
    const f = fixture();
    writeFileSync(join(f.root, name), 'CLERK_SECRET_KEY=private-canary');
    expect(() => runChecks(f.root, 'full', f.env)).toThrow(
      'refuse dotenv files'
    );
    expect(() => f.calls()).toThrow();
  });
});
