#!/usr/bin/env node
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseAgentTimeoutMs } from './sentry-agent-loop.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = join(ROOT, 'scripts', 'ops', 'sentry-agent-loop.mjs');
const EXPECTED_ORIGIN = 'https://github.com/misty-step/linejam.git';

function required(value, name) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required`);
  return normalized;
}

function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? ROOT,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1_024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(
      `${file} ${args.join(' ')} failed with exit ${String(result.status)}${
        detail ? `: ${detail}` : ''
      }`
    );
  }
  return result.stdout.trim();
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function activeHermesProfile(home) {
  const profile = readFileSync(
    join(home, '.hermes', 'active_profile'),
    'utf8'
  ).trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(profile)) {
    throw new Error('Hermes active profile name is invalid');
  }
  return profile;
}

export function installSentryAgentLoop(env = process.env) {
  const home = homedir();
  const endpoint = required(
    env.LINEJAM_SENTRY_AGENT_ENDPOINT,
    'LINEJAM_SENTRY_AGENT_ENDPOINT'
  ).replace(/\/+$/, '');
  const repositoryPath = resolve(env.LINEJAM_REPOSITORY_PATH?.trim() || ROOT);
  const forkRepository = required(
    env.LINEJAM_AGENT_FORK_REPOSITORY,
    'LINEJAM_AGENT_FORK_REPOSITORY'
  );
  const secret = required(
    env.SENTRY_AGENT_LOOP_SECRET,
    'SENTRY_AGENT_LOOP_SECRET'
  );
  const agentTimeoutMs = parseAgentTimeoutMs(
    env.LINEJAM_SENTRY_AGENT_TIMEOUT_MS
  );
  if (secret.length < 32) {
    throw new Error(
      'SENTRY_AGENT_LOOP_SECRET must contain at least 32 characters'
    );
  }
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(endpoint)) {
    throw new Error('LINEJAM_SENTRY_AGENT_ENDPOINT must be an HTTPS origin');
  }
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9._-]{1,100}$/i.test(
      forkRepository
    ) ||
    forkRepository.toLowerCase() === 'misty-step/linejam'
  ) {
    throw new Error(
      'LINEJAM_AGENT_FORK_REPOSITORY must name a fork outside misty-step/linejam'
    );
  }

  run('sentry', ['auth', 'status']);
  run('gh', ['auth', 'status']);
  run('ssh', ['exe.dev', 'ls', '--json']);
  run('omp', ['--version']);
  run('hermes', ['--version']);
  const origin = run('git', ['remote', 'get-url', 'origin'], {
    cwd: repositoryPath,
  });
  if (origin !== EXPECTED_ORIGIN) {
    throw new Error(
      `Linejam origin must be ${EXPECTED_ORIGIN}; received ${origin}`
    );
  }
  const fork = run('gh', [
    'repo',
    'view',
    forkRepository,
    '--json',
    'nameWithOwner,isFork,parent',
    '--jq',
    '[.nameWithOwner, .isFork, (.parent.owner.login + "/" + .parent.name)] | @tsv',
  ]);
  if (fork !== `${forkRepository}\ttrue\tmisty-step/linejam`) {
    throw new Error(
      'LINEJAM_AGENT_FORK_REPOSITORY must be a fork of misty-step/linejam'
    );
  }

  const configPath = join(home, '.config', 'linejam', 'sentry-agent-loop.env');
  const installPath = join(
    home,
    '.local',
    'libexec',
    'linejam',
    'sentry-agent-loop.mjs'
  );
  const profile = activeHermesProfile(home);
  const launcherPath = join(
    home,
    '.hermes',
    'profiles',
    profile,
    'scripts',
    'linejam-sentry-agent-loop.sh'
  );

  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  writeFileSync(
    configPath,
    [
      `LINEJAM_SENTRY_AGENT_ENDPOINT=${shellQuote(endpoint)}`,
      `LINEJAM_REPOSITORY_PATH=${shellQuote(repositoryPath)}`,
      `SENTRY_AGENT_LOOP_SECRET=${shellQuote(secret)}`,
      `LINEJAM_AGENT_FORK_REPOSITORY=${shellQuote(forkRepository)}`,
      `LINEJAM_SENTRY_AGENT_TIMEOUT_MS=${shellQuote(String(agentTimeoutMs))}`,
      '',
    ].join('\n'),
    { mode: 0o600 }
  );
  chmodSync(configPath, 0o600);

  mkdirSync(dirname(installPath), { recursive: true, mode: 0o700 });
  copyFileSync(SOURCE, installPath);
  chmodSync(installPath, 0o700);

  mkdirSync(dirname(launcherPath), { recursive: true, mode: 0o700 });
  writeFileSync(
    launcherPath,
    `#!/usr/bin/env bash\nset -euo pipefail\nset -a\nsource "$HOME/.config/linejam/sentry-agent-loop.env"\nset +a\nexec node "$HOME/.local/libexec/linejam/sentry-agent-loop.mjs"\n`,
    { mode: 0o700 }
  );
  chmodSync(launcherPath, 0o700);

  return { configPath, installPath, launcherPath, profile, repositoryPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const installed = installSentryAgentLoop();
    process.stdout.write(
      `Installed Linejam Sentry agent loop for Hermes profile ${installed.profile}.\nLauncher: ${installed.launcherPath}\n`
    );
  } catch (error) {
    process.stderr.write(
      `Sentry agent loop installation failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exitCode = 1;
  }
}
