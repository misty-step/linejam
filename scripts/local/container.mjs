import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import path from 'node:path';
import { sourceIdentity } from './identity.mjs';

const command = process.argv[2];
const redactions = [];

function safe(text) {
  for (const value of redactions)
    text = text.replaceAll(value, '[local secret]');
  return text;
}

function assertLocal() {
  if (
    process.env.LINEJAM_LOCAL !== '1' ||
    process.env.NEXT_PUBLIC_LINEJAM_LOCAL !== '1' ||
    process.env.LINEJAM_DEPLOY_ENVIRONMENT !== 'development'
  ) {
    throw new Error(
      'Local container commands require both local flags and the development marker.'
    );
  }
  for (const name of [
    'CONVEX_DEPLOY_KEY',
    'CONVEX_DEPLOYMENT',
    'CLERK_SECRET_KEY',
    'SENTRY_AUTH_TOKEN',
  ]) {
    if (process.env[name]) throw new Error(`Local containers refuse ${name}.`);
  }
}

function loopbackUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Local commands accept only explicit http://127.0.0.1:<port> origins.'
    );
  }
  return url.origin;
}

async function secret(name) {
  const value = (await readFile(`/run/secrets/${name}`, 'utf8')).trim();
  if (value.length < 32 || /\s/.test(value)) {
    throw new Error(`Missing or malformed generated local secret: ${name}.`);
  }
  redactions.push(value);
  return value;
}

function run(args, { env = process.env, logFile } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = [];
    const pending = new Map();
    function forward(stream, destination) {
      pending.set(stream, '');
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        const lines = (pending.get(stream) + chunk).split('\n');
        pending.set(stream, lines.pop());
        for (const line of lines) {
          const text = `${safe(line)}\n`;
          destination.write(text);
          if (logFile) output.push(text);
        }
      });
      stream.on('end', () => {
        const text = safe(pending.get(stream));
        destination.write(text);
        if (logFile) output.push(text);
      });
    }
    forward(child.stdout, process.stdout);
    forward(child.stderr, process.stderr);
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const finish = async (error) => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
      if (logFile) await writeFile(logFile, output.join(''));
      if (error) reject(error);
      else resolve();
    };
    child.on('error', (error) => void finish(error).catch(reject));
    child.on('close', (code, signal) => {
      void finish(
        code === 0
          ? null
          : new Error(`pnpm ${args.join(' ')} failed (${signal ?? code}).`)
      ).catch(reject);
    });
  });
}

async function backendCredentials() {
  if (process.env.CONVEX_SERVER_URL !== 'http://convex:3210') {
    throw new Error(
      'Backend writes are restricted to the Compose service http://convex:3210.'
    );
  }
  loopbackUrl(process.env.NEXT_PUBLIC_CONVEX_URL);
  const adminKey = await secret('convex_admin_key');
  const envFile = '/tmp/linejam-convex.env';
  await writeFile(
    envFile,
    `CONVEX_SELF_HOSTED_URL=http://convex:3210\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`,
    { mode: 0o600 }
  );
  return envFile;
}

async function check() {
  const directory = '/artifacts/check';
  await mkdir(directory, { recursive: true });
  const toolEnv = { ...process.env };
  for (const name of [
    'LINEJAM_LOCAL',
    'NEXT_PUBLIC_LINEJAM_LOCAL',
    'LINEJAM_DEPLOY_ENVIRONMENT',
    'NEXT_PUBLIC_CONVEX_URL',
    'CONVEX_SERVER_URL',
    'NEXT_PUBLIC_SENTRY_ENABLED',
    'LINEJAM_SENTRY_ENABLED',
    'GUEST_TOKEN_SECRET',
  ])
    delete toolEnv[name];
  const buildEnv = {
    ...process.env,
    GUEST_TOKEN_SECRET: await secret('guest_token'),
  };
  const result = { startedAt: new Date().toISOString(), steps: [], ok: false };
  try {
    for (const script of [
      'format:check',
      'ci:prepush',
      'test:ci',
      'build:check',
    ]) {
      const step = { command: `pnpm ${script}`, ok: false };
      result.steps.push(step);
      await run([script], {
        env: script === 'build:check' ? buildEnv : toolEnv,
        logFile: path.join(directory, `${script.replaceAll(':', '-')}.log`),
      });
      step.ok = true;
    }
    result.ok = true;
  } finally {
    await writeFile(
      path.join(directory, 'result.json'),
      `${JSON.stringify({ ...result, finishedAt: new Date().toISOString() }, null, 2)}\n`
    );
  }
}

async function withQaTransport(action) {
  const appPort = Number(new URL(loopbackUrl(process.env.E2E_BASE_URL)).port);
  const convexPort = Number(
    new URL(loopbackUrl(process.env.NEXT_PUBLIC_CONVEX_URL)).port
  );
  const sitePort = Number(process.env.LINEJAM_LOCAL_SITE_PORT);
  const routes = [
    [appPort, 'app', 3000],
    [convexPort, 'convex', 3210],
    [sitePort, 'convex', 3211],
  ];
  if (
    routes.some(
      ([port]) => !Number.isInteger(port) || port < 1024 || port > 65535
    ) ||
    new Set(routes.map(([port]) => port)).size !== 3
  )
    throw new Error(
      'QA relay ports must be distinct local ports from 1024 through 65535.'
    );
  const servers = [];
  const sockets = new Set();
  try {
    for (const [port, host, targetPort] of routes) {
      const server = createServer((client) => {
        const upstream = connect({ host, port: targetPort });
        for (const socket of [client, upstream]) {
          sockets.add(socket);
          socket.once('close', () => sockets.delete(socket));
        }
        client.on('error', () => upstream.destroy());
        upstream.on('error', () => client.destroy());
        client.once('close', () => upstream.destroy());
        upstream.once('close', () => client.destroy());
        client.pipe(upstream);
        upstream.pipe(client);
      });
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen({ host: '127.0.0.1', port }, resolve);
      });
    }
    // Raw TCP forwarding preserves real HTTP, WebSocket, cookies and origin
    // checks. These relays exist only for this one-shot browser process.
    return await action();
  } finally {
    for (const socket of sockets) socket.destroy();
    await Promise.all(
      servers.map((server) => new Promise((resolve) => server.close(resolve)))
    );
  }
}

async function main() {
  if (command === 'health') {
    const response = await fetch('http://127.0.0.1:3000/api/health', {
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok || (await response.json()).status !== 'ok') {
      throw new Error('App and real Convex guest-token parity are not ready.');
    }
    return;
  }
  assertLocal();
  await mkdir('/tmp/linejam-home', { recursive: true, mode: 0o700 });
  if (command === 'app') {
    loopbackUrl(process.env.NEXT_PUBLIC_CONVEX_URL);
    if (process.env.CONVEX_SERVER_URL !== 'http://convex:3210') {
      throw new Error(
        'Local Next server requests must use the Compose Convex endpoint.'
      );
    }
    await run(
      [
        'exec',
        'next',
        'dev',
        '--turbopack',
        '--hostname',
        '0.0.0.0',
        '--port',
        '3000',
      ],
      {
        env: {
          ...process.env,
          GUEST_TOKEN_SECRET: await secret('guest_token'),
        },
      }
    );
    return;
  }
  if (command === 'sync' || command === 'watch') {
    const envFile = await backendCredentials();
    if (command === 'sync') {
      const guestSecret = await secret('guest_token');
      const configFile = '/tmp/linejam-backend.env';
      await writeFile(
        configFile,
        [
          'LINEJAM_LOCAL=1',
          'NEXT_PUBLIC_LINEJAM_LOCAL=1',
          'LINEJAM_DEPLOY_ENVIRONMENT=development',
          'LINEJAM_SENTRY_ENABLED=0',
          // Convex auth-config evaluation throws on an absent environment read.
          // Explicit empty issuer inputs select the existing providers: [] path.
          'CLERK_JWT_ISSUER_DOMAIN=',
          'CLERK_FRONTEND_API_URL=',
          'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=',
          `GUEST_TOKEN_SECRET=${guestSecret}`,
          '',
        ].join('\n'),
        { mode: 0o600 }
      );
      console.log(
        'Writing generated guest configuration to this local Convex service only.'
      );
      await run([
        'exec',
        'convex',
        'env',
        'set',
        '--from-file',
        configFile,
        '--force',
        '--env-file',
        envFile,
      ]);
    }
    await run([
      'exec',
      'convex',
      'dev',
      '--env-file',
      envFile,
      '--typecheck',
      'disable',
      '--codegen',
      'disable',
      '--tail-logs',
      'disable',
      ...(command === 'sync' ? ['--once'] : []),
    ]);
    if (command === 'sync') {
      await writeFile(
        '/artifacts/backend-source.json',
        `${JSON.stringify(
          {
            synchronizedAt: new Date().toISOString(),
            source: await sourceIdentity(),
          },
          null,
          2
        )}\n`
      );
    }
    return;
  }
  if (command === 'check') return check();
  if (command === 'qa') {
    return withQaTransport(async () => {
      const baseUrl = loopbackUrl(process.env.E2E_BASE_URL);
      const response = await fetch(`${baseUrl}/api/health`, {
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok || (await response.json()).status !== 'ok') {
        throw new Error(
          'Local QA refuses an unhealthy application. Run local up first.'
        );
      }
      await mkdir('/artifacts/qa', { recursive: true });
      await run([
        'exec',
        'playwright',
        'test',
        '--config=scripts/local/playwright.config.ts',
      ]);
      const result = JSON.parse(
        await readFile('/artifacts/qa/results.json', 'utf8')
      );
      if (
        result.stats.expected === 0 ||
        result.stats.skipped > 0 ||
        result.stats.unexpected > 0
      ) {
        throw new Error(
          'Local lifecycle QA must execute every selected case without skips.'
        );
      }
    });
  }
  throw new Error(
    `Unknown local container command: ${command ?? '(missing)'}.`
  );
}

main().catch((error) => {
  console.error(safe(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
