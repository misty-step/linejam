#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const checkoutId = createHash('sha256').update(root).digest('hex').slice(0, 12);
const ownerLabel = 'io.linejam.local.owner';
const checkoutLabel = 'io.linejam.local.checkout';
const secrets = [];
const commands = new Set([
  'up',
  'dev',
  'status',
  'down',
  'reset',
  'check',
  'qa',
]);
const help = `Linejam: isolated local Docker runtime (Linux containers; Node 22+; Compose 5.5+)

  node scripts/local/cli.mjs <up|dev|status|down|reset|check|qa> [options]

  --project NAME       Local project suffix (default dev-${checkoutId.slice(0, 8)})
  --app-port PORT      Browser app port (default 3333)
  --convex-port PORT   Browser Convex port (default 3210)
  --site-port PORT     Convex HTTP-action port (default 3211)
  --confirm PROJECT   Required for reset; full name: linejam-local-NAME
  --help               Show this help without contacting Docker

up      Build, start local Convex, sync source/config, start Next, prove readiness.
dev     Do up, then watch isolated source copies; Ctrl-C stops this project's services.
status  Show this project's services and the last successful readiness receipt.
down    Stop/remove only owned containers/network; preserve data, keys and artifacts.
reset   Stop/remove only owned resources, including database, keys and artifacts.
check   One-shot containerized repository checks with networking disabled.
qa      Do up, then real two-guest browser cycle/reveal/rematch + evidence capture.

up and qa leave services running. Their caller must run down or reset.
No caller dotenv files, cloud credentials, Docker registry logins or remote daemon
contexts are used. DOCKER_HOST may select an explicit local unix:// socket.
`;

function parse(argv) {
  if (argv.includes('--help') || argv.length === 0) return null;
  const [command, ...rest] = argv;
  if (!commands.has(command))
    throw new Error(`Unknown command: ${command}. Use --help.`);
  const options = { command };
  const allowed = new Set([
    'project',
    'app-port',
    'convex-port',
    'site-port',
    'confirm',
  ]);
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (
      !flag.startsWith('--') ||
      !allowed.has(flag.slice(2)) ||
      !value ||
      value.startsWith('--')
    ) {
      throw new Error(
        `Invalid option: ${flag}. Options use separate flag/value arguments.`
      );
    }
    const name = flag.slice(2);
    if (options[name] !== undefined)
      throw new Error(`Repeated option: ${flag}.`);
    options[name] = value;
  }
  options.project ??= `dev-${checkoutId.slice(0, 8)}`;
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(options.project) ||
    options.project.length > 32
  ) {
    throw new Error(
      'Project must be a lowercase letter followed by letters/digits/hyphens, at most 32 characters.'
    );
  }
  if (
    /(^|-)(production|prod|preview|shared|cloud)(-|$)/.test(options.project)
  ) {
    throw new Error(
      'Reserved deployment names are not allowed for local projects.'
    );
  }
  if (options.confirm && command !== 'reset')
    throw new Error('--confirm is only valid with reset.');
  if (
    command === 'reset' &&
    options.confirm !== `linejam-local-${options.project}`
  ) {
    throw new Error(
      `Reset requires --confirm linejam-local-${options.project}.`
    );
  }
  return options;
}

function port(value) {
  if (
    !/^\d{4,5}$/.test(String(value)) ||
    Number(value) < 1024 ||
    Number(value) > 65535
  ) {
    throw new Error('Ports must be integer values from 1024 through 65535.');
  }
  return Number(value);
}

function ports(options, existing = {}) {
  const result = {
    app: port(options['app-port'] ?? existing.app ?? 3333),
    convex: port(options['convex-port'] ?? existing.convex ?? 3210),
    site: port(options['site-port'] ?? existing.site ?? 3211),
  };
  if (new Set(Object.values(result)).size !== 3)
    throw new Error('App, Convex and site ports must be distinct.');
  return result;
}

function localSocket(value) {
  if (!/^unix:\/\/\/[^\0\r\n]+$/.test(value)) {
    throw new Error(
      'Local commands refuse remote Docker daemons; DOCKER_HOST must use an absolute unix:// socket.'
    );
  }
  const socket = value.slice('unix://'.length);
  if (path.normalize(socket) !== socket)
    throw new Error('Docker socket path must be canonical.');
  return value;
}

function assertLocalAuthority() {
  if (!['linux', 'darwin'].includes(process.platform))
    throw new Error(
      'Use a Linux/macOS host with a local Unix-socket Docker daemon.'
    );
  if (Number(process.versions.node.split('.')[0]) < 22)
    throw new Error('Use Node 22 or newer for the host CLI.');
  const environment = process.env.LINEJAM_DEPLOY_ENVIRONMENT;
  if (environment && environment !== 'development')
    throw new Error(
      'Local commands refuse non-development deployment markers.'
    );
  if (process.env.NODE_ENV === 'production')
    throw new Error(
      'Unset host NODE_ENV=production before using local runtime commands.'
    );
  if (process.env.DOCKER_HOST) localSocket(process.env.DOCKER_HOST);
  if (process.env.DOCKER_CONTEXT && process.env.DOCKER_CONTEXT !== 'default') {
    throw new Error(
      'Unset DOCKER_CONTEXT; local commands select an explicit Unix socket, not a named context.'
    );
  }
}

async function directory(absolute, create = false) {
  if (create) {
    try {
      await mkdir(absolute, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  const stat = await lstat(absolute);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid()
  ) {
    throw new Error(
      `Refusing a symlink, foreign-owned, or non-directory state path: ${absolute}.`
    );
  }
}

async function ownedFile(absolute) {
  const stat = await lstat(absolute);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid()
  ) {
    throw new Error(`Refusing an unsafe local state file: ${absolute}.`);
  }
  return readFile(absolute, 'utf8');
}

async function stateFor(options) {
  const project = `linejam-local-${options.project}`;
  const state = path.join(root, '.qa', 'local', project);
  const create = ['up', 'dev', 'check', 'qa'].includes(options.command);
  for (const absolute of [
    path.join(root, '.qa'),
    path.join(root, '.qa/local'),
  ]) {
    try {
      await directory(absolute, create);
    } catch (error) {
      if (error.code === 'ENOENT' && options.command === 'status') return null;
      throw error;
    }
  }
  let exists = true;
  try {
    await directory(state);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    exists = false;
  }
  if (!exists && !create) {
    if (options.command === 'status') return null;
    throw new Error(
      `No owned local state for ${project}; refusing resource removal.`
    );
  }
  let config;
  if (exists) {
    config = JSON.parse(await ownedFile(path.join(state, 'owner.json')));
    if (
      config.schemaVersion !== 1 ||
      config.project !== project ||
      config.checkout !== root ||
      config.checkoutId !== checkoutId ||
      !/^[0-9a-f-]{36}$/.test(config.owner)
    )
      throw new Error(
        'Local ownership marker does not match this checkout/project.'
      );
    const requested = ports(options, config.ports);
    if (JSON.stringify(requested) !== JSON.stringify(config.ports)) {
      throw new Error(
        'Existing project ports cannot change. Use a different project, or reset the current one first.'
      );
    }
    localSocket(config.dockerHost);
    if (
      process.env.DOCKER_HOST &&
      process.env.DOCKER_HOST !== config.dockerHost
    ) {
      throw new Error(
        'This project belongs to a different local Docker socket. Use its recorded socket or choose another project.'
      );
    }
  } else {
    const selectedPorts = ports(options);
    await directory(state, true);
    config = {
      schemaVersion: 1,
      project,
      checkout: root,
      checkoutId,
      owner: randomUUID(),
      ports: selectedPorts,
      dockerHost: localSocket(
        process.env.DOCKER_HOST ?? 'unix:///var/run/docker.sock'
      ),
      createdAt: new Date().toISOString(),
    };
    await writeFile(
      path.join(state, 'owner.json'),
      `${JSON.stringify(config, null, 2)}\n`,
      { mode: 0o600, flag: 'wx' }
    );
  }
  for (const name of ['secrets', 'artifacts', 'docker-config'])
    await directory(path.join(state, name), !exists);
  if (!exists) {
    await writeFile(
      path.join(state, 'secrets/guest-token'),
      randomBytes(48).toString('base64url'),
      { mode: 0o600, flag: 'wx' }
    );
    await writeFile(path.join(state, 'secrets/convex-admin-key'), '', {
      mode: 0o600,
      flag: 'wx',
    });
  }
  if (create) {
    const guest = (
      await ownedFile(path.join(state, 'secrets/guest-token'))
    ).trim();
    if (!/^[A-Za-z0-9_-]{64}$/.test(guest))
      throw new Error(
        'Generated local guest key is missing/corrupt. Reset this owned project to regenerate it.'
      );
    secrets.push(guest);
    const previousAdmin = (
      await ownedFile(path.join(state, 'secrets/convex-admin-key'))
    ).trim();
    if (previousAdmin) secrets.push(previousAdmin);
  }
  return { ...config, state };
}

function safe(text) {
  for (const value of secrets) text = text.replaceAll(value, '[local secret]');
  return text;
}

function docker(
  config,
  args,
  { capture = false, privateOutput = false, allowInterrupt = false } = {}
) {
  const env = {
    PATH: process.env.PATH,
    HOME: config.state,
    DOCKER_CONFIG: path.join(config.state, 'docker-config'),
    COMPOSE_DISABLE_ENV_FILE: '1',
    COMPOSE_INTERACTIVE_NO_CLI: '1',
  };
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['--host', config.dockerHost, ...args], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text) => {
      if (capture) stdout += text;
      else process.stdout.write(safe(text));
    });
    child.stderr.on('data', (text) => {
      stderr = (stderr + text).slice(-16000);
      if (!capture) process.stderr.write(safe(text));
    });
    let interrupted = false;
    const interrupt = () => {
      interrupted = true;
      child.kill('SIGINT');
    };
    const terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const clean = () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
    };
    child.on('error', (error) => {
      clean();
      reject(error);
    });
    child.on('close', (code, signal) => {
      clean();
      if (
        code === 0 ||
        (allowInterrupt && interrupted && (code === 130 || signal === 'SIGINT'))
      )
        resolve(stdout.trim());
      else
        reject(
          new Error(
            privateOutput
              ? 'Local backend key generation failed; no key output was exposed.'
              : `docker ${args.join(' ')} failed (${signal ?? code}).${capture ? `\n${safe(stderr.trim())}` : ''}`
          )
        );
    });
  });
}

function compose(config, args, options) {
  return docker(
    config,
    [
      'compose',
      '--project-directory',
      root,
      '--file',
      path.join(root, 'compose.yaml'),
      '--env-file',
      path.join(config.state, 'compose.env'),
      '--project-name',
      config.project,
      ...args,
    ],
    options
  );
}

async function writeComposeEnvironment(config) {
  // The explicit env-file disables Compose's ambient .env discovery. Only
  // generated non-secret interpolation values enter it; secret files are mounts.
  const values = {
    LINEJAM_LOCAL_PROJECT: config.project,
    LINEJAM_LOCAL_OWNER: config.owner,
    LINEJAM_LOCAL_CHECKOUT: config.checkoutId,
    LINEJAM_LOCAL_STATE: config.state,
    LINEJAM_LOCAL_UID: config.containerUid,
    LINEJAM_LOCAL_GID: config.containerGid,
    LINEJAM_LOCAL_APP_PORT: config.ports.app,
    LINEJAM_LOCAL_CONVEX_PORT: config.ports.convex,
    LINEJAM_LOCAL_SITE_PORT: config.ports.site,
  };
  // Compose dotenv supports single-quoted literal paths. Refuse unusual checkout
  // names rather than allowing interpolation or changing the authority path.
  if (/[\r\n']/.test(config.state))
    throw new Error('Local checkout path cannot contain a quote or newline.');
  await writeFile(
    path.join(config.state, 'compose.env'),
    Object.entries(values)
      .map(([name, value]) => `${name}='${value}'`)
      .join('\n') + '\n',
    { mode: 0o600 }
  );
}

async function requireDocker(config) {
  const version = await docker(config, ['compose', 'version', '--short'], {
    capture: true,
  });
  const match = /^v?(\d+)\.(\d+)\./.exec(version);
  if (
    !match ||
    Number(match[1]) < 5 ||
    (Number(match[1]) === 5 && Number(match[2]) < 5)
  ) {
    throw new Error(
      'Install Docker Compose 5.5+ for isolated watch/initial sync.'
    );
  }
  const os = await docker(config, ['version', '--format', '{{.Server.Os}}'], {
    capture: true,
  });
  if (os !== 'linux')
    throw new Error('Local runtime requires a Linux Docker daemon.');
  const security = JSON.parse(
    await docker(config, ['info', '--format', '{{json .SecurityOptions}}'], {
      capture: true,
    })
  );
  const rootless =
    Array.isArray(security) &&
    security.some((option) => option === 'name=rootless');
  // Rootless container UID 0 maps to the caller; UID 1000 maps to a subordinate
  // host UID and cannot read mode-600 secret bind mounts owned by the caller.
  config.containerUid = rootless ? 0 : process.getuid();
  config.containerGid = rootless ? 0 : process.getgid();
}

async function assertOwnedResources(config) {
  for (const [kind, list, format, expectedName] of [
    ['container', ['ps', '--all'], '{{.ID}}', null],
    ['network', ['network', 'ls'], '{{.ID}}', `${config.project}_default`],
    ['volume', ['volume', 'ls'], '{{.Name}}', `${config.project}_data`],
  ]) {
    const filters = [`label=com.docker.compose.project=${config.project}`];
    // Compose also adopts/removes declared names regardless of their project label.
    if (expectedName) filters.push(`name=^${expectedName}$`);
    const matches = await Promise.all(
      filters.map((filter) =>
        docker(config, [...list, '--filter', filter, '--format', format], {
          capture: true,
        })
      )
    );
    const ids = new Set(
      matches.flatMap((text) => text.split('\n').filter(Boolean))
    );
    for (const id of ids) {
      const field = kind === 'container' ? '.Config.Labels' : '.Labels';
      const labels = JSON.parse(
        await docker(
          config,
          [kind, 'inspect', '--format', `{{json ${field}}}`, id],
          { capture: true }
        )
      );
      if (
        labels?.[ownerLabel] !== config.owner ||
        labels?.[checkoutLabel] !== config.checkoutId ||
        labels?.['com.docker.compose.project'] !== config.project
      ) {
        throw new Error(
          `Refusing foreign ${kind} ${id} in ${config.project}; no resources were removed.`
        );
      }
    }
  }
}

async function lock(config, command) {
  const file = path.join(config.state, 'operation.lock');
  let handle;
  try {
    handle = await open(file, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = JSON.parse(await ownedFile(file));
    if (!Number.isInteger(previous.pid) || previous.pid < 1)
      throw new Error(
        'Invalid local operation lock; refusing concurrent mutation.'
      );
    try {
      process.kill(previous.pid, 0);
      throw new Error(
        `Project is owned by active ${previous.command} PID ${previous.pid}; stop that command first, or choose another project.`
      );
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    // A dead PID does not authorize unlinking: another contender may have
    // replaced the file since we read it. Portable unlink has no identity guard.
    throw new Error(
      `Stale local operation lock from ${previous.command} PID ${previous.pid}: ${file}. Stop all commands for this project, verify its ownership marker and that PID is still absent, then manually remove only operation.lock; or choose another project.`
    );
  }
  await handle.writeFile(
    JSON.stringify({
      pid: process.pid,
      command,
      startedAt: new Date().toISOString(),
    })
  );
  await handle.close();
  return () => unlink(file);
}

async function healthy(config) {
  const origin = `http://127.0.0.1:${config.ports.app}`;
  let response;
  try {
    response = await fetch(`${origin}/api/health`, {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(
      `Local app at ${origin} is unreachable from the host. Check published Docker ports; container health alone is insufficient.`,
      { cause: error }
    );
  }
  const report = await response.json();
  if (
    !response.ok ||
    report.status !== 'ok' ||
    report.env?.guestTokenParity !== true
  ) {
    throw new Error(
      'Local app/Convex health or generated guest-key parity is not ready.'
    );
  }
  return report;
}

async function containerImage(config, service) {
  const id = await compose(config, ['ps', '--quiet', service], {
    capture: true,
  });
  if (!id || id.includes('\n'))
    throw new Error(`Expected one owned ${service} container.`);
  return docker(
    config,
    ['container', 'inspect', '--format', '{{.Image}}', id],
    { capture: true }
  );
}

async function up(config) {
  await compose(config, ['build', 'app']);
  await compose(config, [
    'up',
    '--detach',
    '--wait',
    '--wait-timeout',
    '180',
    'convex',
  ]);
  const admin = await compose(
    config,
    ['exec', '-T', 'convex', './generate_admin_key.sh'],
    { capture: true, privateOutput: true }
  );
  if (admin.length < 32 || /\s/.test(admin))
    throw new Error(
      'Backend returned an invalid local admin key; output was withheld.'
    );
  secrets.push(admin);
  await writeFile(path.join(config.state, 'secrets/convex-admin-key'), admin, {
    mode: 0o600,
  });
  await compose(config, ['run', '--rm', '--no-deps', '-T', 'sync']);
  await compose(config, [
    'up',
    '--detach',
    '--no-build',
    '--wait',
    '--wait-timeout',
    '300',
    'app',
  ]);
  const report = await healthy(config);
  const synchronized = JSON.parse(
    await ownedFile(path.join(config.state, 'artifacts/backend-source.json'))
  );
  const appSource = JSON.parse(
    await compose(
      config,
      ['exec', '-T', 'app', 'node', 'scripts/local/identity.mjs'],
      { capture: true }
    )
  );
  if (synchronized.source.frontend.sha256 !== appSource.frontend.sha256) {
    throw new Error(
      'Frontend and synchronized backend source snapshots differ; readiness receipt was not issued.'
    );
  }
  const receipt = {
    schemaVersion: 1,
    project: config.project,
    observedAt: new Date().toISOString(),
    scope:
      'Exact source at the last successful one-shot synchronization; watch edits require a new up/qa receipt.',
    urls: {
      app: `http://127.0.0.1:${config.ports.app}`,
      convex: `http://127.0.0.1:${config.ports.convex}`,
      site: `http://127.0.0.1:${config.ports.site}`,
      serverOnly: 'http://convex:3210',
    },
    source: appSource,
    backendSynchronizedAt: synchronized.synchronizedAt,
    images: {
      app: await containerImage(config, 'app'),
      convex: await containerImage(config, 'convex'),
    },
    readiness: {
      app: report.status,
      convex: report.convex,
      guestTokenParity: report.env.guestTokenParity,
    },
  };
  await writeFile(
    path.join(config.state, 'receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { mode: 0o600 }
  );
  console.log(
    `Ready: ${receipt.urls.app}\nReceipt: ${path.relative(root, path.join(config.state, 'receipt.json'))}`
  );
}

async function down(config, reset = false) {
  await assertOwnedResources(config);
  await compose(config, [
    '--profile',
    'watch',
    '--profile',
    'tools',
    'down',
    ...(reset ? ['--volumes'] : []),
  ]);
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (!options) {
    console.log(help);
    return;
  }
  assertLocalAuthority();
  const config = await stateFor(options);
  if (!config) {
    console.log(`linejam-local-${options.project}: not initialized.`);
    return;
  }
  const unlock =
    options.command === 'status'
      ? async () => {}
      : await lock(config, options.command);
  let removedState = false;
  try {
    await requireDocker(config);
    if (options.command === 'status') {
      await ownedFile(path.join(config.state, 'compose.env'));
    } else {
      await writeComposeEnvironment(config);
    }
    await assertOwnedResources(config);
    if (options.command === 'status') {
      await compose(config, [
        '--profile',
        'watch',
        '--profile',
        'tools',
        'ps',
        '--all',
      ]);
      try {
        console.log(await ownedFile(path.join(config.state, 'receipt.json')));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        console.log('No successful readiness receipt yet.');
      }
    } else if (options.command === 'up') {
      await up(config);
    } else if (options.command === 'dev') {
      try {
        await up(config);
        await compose(config, [
          '--profile',
          'watch',
          'up',
          '--detach',
          '--no-build',
          'convex-watch',
        ]);
        console.log(
          'Watching isolated source copies. Ctrl-C tears down this project and preserves its data.'
        );
        await compose(
          config,
          [
            '--profile',
            'watch',
            'watch',
            '--no-up',
            '--prune=false',
            'app',
            'convex-watch',
          ],
          { allowInterrupt: true }
        );
      } finally {
        await down(config);
      }
    } else if (options.command === 'down' || options.command === 'reset') {
      await down(config, options.command === 'reset');
      if (options.command === 'reset') {
        await directory(config.state);
        const retiredState = `${config.state}.reset-${randomUUID()}`;
        // Atomically retire the locked directory before deleting it. A new up
        // can then create a fresh owner without racing recursive deletion.
        await rename(config.state, retiredState);
        removedState = true;
        await rm(retiredState, { recursive: true });
        console.log(
          `Reset only ${config.project}. Shared Docker images/build caches were retained.`
        );
      }
    } else if (options.command === 'check') {
      await compose(config, ['build', 'check']);
      await compose(config, ['run', '--rm', '--no-deps', '-T', 'check']);
      console.log(
        `Check artifacts: ${path.relative(root, path.join(config.state, 'artifacts/check'))}`
      );
    } else if (options.command === 'qa') {
      await up(config);
      await compose(config, ['build', 'qa']);
      await compose(config, ['run', '--rm', '--no-deps', '-T', 'qa']);
      console.log(
        `QA artifacts: ${path.relative(root, path.join(config.state, 'artifacts/qa'))}\nServices remain running; the caller must run local down or reset.`
      );
    }
  } finally {
    if (!removedState) await unlock();
  }
}

main().catch((error) => {
  console.error(safe(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
