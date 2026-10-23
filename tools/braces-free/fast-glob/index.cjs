'use strict';

// Stand-in for fast-glob@3.3.1, installed only for @next/eslint-plugin-next
// through a pnpm override (#604). fast-glob depends on micromatch, which
// installs braces@3.0.3 (GHSA-vfj7-8cjw-p6xm, no fixed release). The plugin's
// get-root-dirs utility calls globSync(pattern, { onlyDirectories: true }).
// tinyglobby matches that result once directory expansion is disabled and its
// trailing directory slash is removed. Other options and entry points are
// rejected so a new caller fails loudly instead of drifting silently.
const { globSync: tinyGlobSync } = require('tinyglobby');

const supportedOptions = new Set(['onlyDirectories']);

function globSync(patterns, options = {}) {
  for (const key of Object.keys(options)) {
    if (!supportedOptions.has(key)) {
      throw new Error(`Unsupported fast-glob option in stand-in: ${key}`);
    }
  }
  const matches = tinyGlobSync(patterns, {
    onlyDirectories: options.onlyDirectories === true,
    expandDirectories: false,
  });
  return options.onlyDirectories === true
    ? matches.map((match) => match.replace(/\/$/, ''))
    : matches;
}

module.exports = { globSync };
