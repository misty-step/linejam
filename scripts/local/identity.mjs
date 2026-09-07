import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceRoots = [
  'app',
  'components',
  'hooks',
  'lib',
  'convex',
  'config',
  'public',
  'content',
  'scripts/local',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'next.config.ts',
  'postcss.config.mjs',
  'middleware.ts',
  'instrumentation.ts',
  'instrumentation-client.ts',
  'sentry.edge.config.ts',
  'sentry.server.config.ts',
  'sentry.runtime.mjs',
  'sentry.provenance.mjs',
];

async function collect(relative, files) {
  const absolute = path.join(root, relative);
  const stat = await lstat(absolute);
  if (stat.isSymbolicLink()) {
    throw new Error(`Source identity refuses a symlink: ${relative}`);
  }
  if (stat.isDirectory()) {
    for (const name of (await readdir(absolute)).sort()) {
      if (name.startsWith('.env') || name === 'node_modules') continue;
      await collect(`${relative}/${name}`, files);
    }
  } else if (stat.isFile()) {
    files.push(relative);
  }
}

export async function sourceIdentity() {
  const files = [];
  for (const relative of sourceRoots) await collect(relative, files);
  files.sort();
  const frontend = createHash('sha256');
  const backend = createHash('sha256');
  let backendFiles = 0;
  for (const relative of files) {
    const bytes = await readFile(path.join(root, relative));
    const fingerprint = createHash('sha256').update(bytes).digest('hex');
    const record = `${relative}\0${fingerprint}\n`;
    frontend.update(record);
    // Convex imports rateLimit, the environment manifest, and provenance code.
    // Hash all lib/config files as well so future imports remain covered.
    if (
      relative.startsWith('convex/') ||
      relative.startsWith('lib/') ||
      relative.startsWith('config/') ||
      relative.startsWith('sentry.') ||
      [
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'tsconfig.json',
      ].includes(relative)
    ) {
      backend.update(record);
      backendFiles++;
    }
  }
  const packageJson = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8')
  );
  return {
    algorithm: 'sha256(sorted relative-path + NUL + file-sha256 + newline)',
    frontend: { sha256: frontend.digest('hex'), files: files.length },
    backend: { sha256: backend.digest('hex'), files: backendFiles },
    node: process.version,
    packageManager: packageJson.packageManager,
    lockfile: createHash('sha256')
      .update(await readFile(path.join(root, 'pnpm-lock.yaml')))
      .digest('hex'),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(JSON.stringify(await sourceIdentity()));
}
