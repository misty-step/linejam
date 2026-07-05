/**
 * Static releases infrastructure.
 *
 * .github/workflows/release.yml → scripts/release/write-release-from-git.mjs
 * → content/releases/ → Page rendering (see docs/releases-static-store.md).
 */

export * from './types';
export * from './loader';
