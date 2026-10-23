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
//
// Result shape follows fast-glob@3.3.1:
// - duplicate slashes after the first character are collapsed;
// - a static pattern is stat'ed and returned exactly as written when it is a
//   directory, so roots such as `/` and `C:/` are returned unchanged;
// - a dynamic pattern is walked from its base directory as written, and each
//   result is that base joined to the matched path with no trailing slash.
//   Relative bases stay relative, `./` and `../` prefixes are kept, and
//   absolute bases (including `/` and `C:/`) stay absolute.
//
// One deliberate divergence: fast-glob@3.3.1 returns [] for a dynamic pattern
// with `?` and a trailing slash (`ap?/`), although `ap?` matches `app`. The
// stand-in returns the matching directories for both.
const { statSync } = require('node:fs');
const picomatch = require('picomatch');
const { globSync: tinyGlobSync, isDynamicPattern } = require('tinyglobby');

// Copied from fast-glob@3.3.1 out/utils/pattern.js.
// fast-glob: Copyright (c) Denis Malinochkin. Released under the MIT License;
// the original license and permission notice are in ./LICENSE.
const DOUBLE_SLASH_RE = /(?!^)\/{2,}/g;
const ROOT_RE = /^(?:\/|[A-Za-z]:\/)$/;

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

// Remove trailing slashes without turning a filesystem root into an empty
// or drive-relative path (`/` -> '', `C:/` -> `C:`).
function trimTrailingSlash(path) {
  let trimmed = path;
  while (trimmed.endsWith('/') && !ROOT_RE.test(trimmed)) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function joinBase(base, relative) {
  if (base === '') return relative;
  return base.endsWith('/') ? base + relative : `${base}/${relative}`;
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function globSync(pattern, options) {
  assertSupportedCall(pattern, options);
  const normalized = pattern.replace(DOUBLE_SLASH_RE, '/');

  if (!isDynamicPattern(normalized)) {
    return isDirectory(normalized) ? [normalized] : [];
  }

  const { glob } = picomatch.scan(normalized);
  if (glob === '' || !normalized.endsWith(glob)) {
    throw new Error(`fast-glob stand-in cannot split pattern: ${normalized}`);
  }
  const base = trimTrailingSlash(normalized.slice(0, -glob.length));
  const matches = tinyGlobSync(glob, {
    cwd: base === '' ? '.' : base,
    onlyDirectories: true,
    expandDirectories: false,
  });
  // Matched names are relative to the base and are never roots, so every
  // trailing slash goes (a directory literally named `C:` stays `C:`).
  return matches.map((match) => joinBase(base, match.replace(/\/+$/, '')));
}

module.exports = { globSync, trimTrailingSlash };
