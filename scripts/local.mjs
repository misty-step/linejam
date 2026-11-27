// Local runtime for development and verification: a real `wrangler dev`
// (workerd + SQLite Durable Objects) on loopback, with a generated secret and
// no cloud credentials. It refuses anything that looks like a production
// credential rather than running with it.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const devVars = join(root, '.dev.vars');

const CLOUD_CREDENTIALS = /^(CLOUDFLARE_|CF_|WRANGLER_|GUEST_TOKEN_SECRET$|LINEJAM_ADMIN_KEY$)/;

/** `.dev.vars` holds only generated, `local-` prefixed secrets. Anything else is refused. */
export function ensureLocalSecrets() {
  if (!existsSync(devVars)) {
    writeFileSync(
      devVars,
      `GUEST_TOKEN_SECRET=local-${randomBytes(24).toString('hex')}\nLINEJAM_ADMIN_KEY=local-${randomBytes(24).toString('hex')}\n`,
      { mode: 0o600 }
    );
  }
  const vars = Object.fromEntries(
    readFileSync(devVars, 'utf8')
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
  );
  for (const name of ['GUEST_TOKEN_SECRET', 'LINEJAM_ADMIN_KEY']) {
    if (!vars[name]?.startsWith('local-')) {
      throw new Error(`.dev.vars ${name} is not a generated local secret. Refusing to run local verification with it.`);
    }
  }
  return vars;
}

/** The child environment: the parent's, minus every cloud credential. */
export function localEnv() {
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!CLOUD_CREDENTIALS.test(name)) env[name] = value;
  }
  return { ...env, WRANGLER_SEND_METRICS: 'false', CI: '1', FORCE_COLOR: '0' };
}

/**
 * Start `wrangler dev` on loopback with throwaway Durable Object storage.
 * Resolves once the Worker answers /api/health.
 */
export async function startLocalWorker({ port, quiet = true } = {}) {
  ensureLocalSecrets();
  const persist = mkdtempSync(join(tmpdir(), 'linejam-local-'));
  const child = spawn(
    join(root, 'node_modules/.bin/wrangler'),
    [
      'dev',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--persist-to',
      persist,
      '--show-interactive-dev-session=false',
    ],
    { cwd: root, env: localEnv(), stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let log = '';
  const keep = (chunk) => {
    log = (log + chunk).slice(-20_000);
    if (!quiet) process.stderr.write(chunk);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
    rmSync(persist, { recursive: true, force: true });
  };
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (child.exitCode !== null) {
      rmSync(persist, { recursive: true, force: true });
      throw new Error(`wrangler dev exited with ${child.exitCode}\n${log}`);
    }
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return { url, stop, log: () => log };
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`wrangler dev did not become healthy\n${log}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
