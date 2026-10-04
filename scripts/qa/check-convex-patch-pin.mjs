#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse } from 'yaml';

const WORKSPACE_MANIFEST = 'pnpm-workspace.yaml';
const LOCKFILE = 'pnpm-lock.yaml';

function parseYaml(contents, relativePath) {
  try {
    return parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse ${relativePath}: ${error.message}`);
  }
}

function resolvedDependencyVersion(dependency) {
  const reference =
    typeof dependency === 'string' ? dependency : dependency?.version;
  if (typeof reference !== 'string' || reference.trim() === '') {
    throw new Error(
      'pnpm-lock.yaml does not contain a resolved root convex dependency.'
    );
  }

  const version = reference.split('(', 1)[0].trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(
      `pnpm-lock.yaml has an unsupported resolved convex version: ${reference}`
    );
  }
  return version;
}

export async function checkConvexPatchPin({ root = process.cwd() } = {}) {
  const workspacePath = path.join(root, WORKSPACE_MANIFEST);
  const lockfilePath = path.join(root, LOCKFILE);
  const [workspaceContents, lockfileContents] = await Promise.all([
    readFile(workspacePath, 'utf8'),
    readFile(lockfilePath, 'utf8'),
  ]);
  const workspace = parseYaml(workspaceContents, WORKSPACE_MANIFEST);
  const lockfile = parseYaml(lockfileContents, LOCKFILE);

  const convexDependency = lockfile?.importers?.['.']?.dependencies?.convex;
  const resolvedVersion = resolvedDependencyVersion(convexDependency);
  const patchKey = `convex@${resolvedVersion}`;
  const patchedDependencies = workspace?.patchedDependencies;
  const patchPath = patchedDependencies?.[patchKey];

  if (typeof patchPath !== 'string' || patchPath.trim() === '') {
    throw new Error(
      `Resolved ${patchKey} is not a key in ${WORKSPACE_MANIFEST} patchedDependencies.`
    );
  }

  const normalizedPatchPath = patchPath.trim();
  let patchStat;
  try {
    patchStat = await stat(path.resolve(root, normalizedPatchPath));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `${WORKSPACE_MANIFEST} patch file is missing: ${normalizedPatchPath}`
      );
    }
    throw error;
  }
  if (!patchStat.isFile()) {
    throw new Error(
      `${WORKSPACE_MANIFEST} patch path is not a file: ${normalizedPatchPath}`
    );
  }

  return { patchKey, patchPath: normalizedPatchPath, resolvedVersion };
}

async function run() {
  try {
    const result = await checkConvexPatchPin();
    console.log(`convex-patch-pin: ${result.patchKey} -> ${result.patchPath}`);
  } catch (error) {
    console.error(`convex-patch-pin: ${error.message}`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await run();
}
