'use strict';

// Stand-in for fast-glob@3.3.1, installed only for @next/eslint-plugin-next
// through a pnpm override (#604). fast-glob depends on micromatch, which
// installs braces@3.0.3 (GHSA-vfj7-8cjw-p6xm, no fixed release). The plugin's
// get-root-dirs utility makes exactly one call:
//
//   globSync(rootDir.replace(/\\/g, '/'), { onlyDirectories: true })
//
// Only that call is supported. Any other pattern type, option or option
// value (including omitted options, {} and { onlyDirectories: false }) throws,
// so a changed caller fails loudly instead of drifting into an untested mode.
const { globSync: tinyGlobSync } = require('tinyglobby');

function assertSupportedCall(pattern, options) {
  if (Object.prototype.toString.call(pattern) !== '[object String]') {
    throw new TypeError(
      'fast-glob stand-in supports only a single string pattern'
    );
  }
  const isPlainObject =
    Object.prototype.toString.call(options) === '[object Object]';
  const unsupported = isPlainObject
    ? Object.keys(options).find((key) => key !== 'onlyDirectories')
    : undefined;
  if (unsupported !== undefined) {
    throw new Error(`Unsupported fast-glob option in stand-in: ${unsupported}`);
  }
  if (!isPlainObject || options.onlyDirectories !== true) {
    throw new Error(
      'fast-glob stand-in supports only { onlyDirectories: true }'
    );
  }
}

function globSync(pattern, options) {
  assertSupportedCall(pattern, options);
  const matches = tinyGlobSync(pattern, {
    onlyDirectories: true,
    expandDirectories: false,
  });
  return matches.map((match) => match.replace(/\/$/, ''));
}

module.exports = { globSync };
