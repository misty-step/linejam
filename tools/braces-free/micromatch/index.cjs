'use strict';

// Stand-in for micromatch@4.0.8, installed only for semantic-release and
// @semantic-release/commit-analyzer through pnpm overrides (#604). Those
// packages call micromatch(list, patterns) and micromatch.isMatch(); neither
// path uses braces, yet micromatch's dependency installs braces@3.0.3
// (GHSA-vfj7-8cjw-p6xm, no fixed release). Both functions below are ported
// verbatim from micromatch@4.0.8 on the same picomatch major. Brace
// expansion helpers are deliberately absent so any new caller fails loudly.
//
// micromatch: Copyright (c) 2014-present, Jon Schlinkert. Released under the
// MIT License; the original license and permission notice are in ./LICENSE.
const picomatch = require('picomatch');

const micromatch = (list, patterns, options) => {
  patterns = [].concat(patterns);
  list = [].concat(list);

  const omit = new Set();
  const keep = new Set();
  const items = new Set();
  let negatives = 0;

  const onResult = (state) => {
    items.add(state.output);
    if (options && options.onResult) {
      options.onResult(state);
    }
  };

  for (let i = 0; i < patterns.length; i++) {
    const isMatch = picomatch(
      String(patterns[i]),
      { ...options, onResult },
      true
    );
    const negated = isMatch.state.negated || isMatch.state.negatedExtglob;
    if (negated) negatives++;

    for (const item of list) {
      const matched = isMatch(item, true);

      const match = negated ? !matched.isMatch : matched.isMatch;
      if (!match) continue;

      if (negated) {
        omit.add(matched.output);
      } else {
        omit.delete(matched.output);
        keep.add(matched.output);
      }
    }
  }

  const result = negatives === patterns.length ? [...items] : [...keep];
  const matches = result.filter((item) => !omit.has(item));

  if (options && matches.length === 0) {
    if (options.failglob === true) {
      throw new Error(`No matches found for "${patterns.join(', ')}"`);
    }

    if (options.nonull === true || options.nullglob === true) {
      return options.unescape
        ? patterns.map((p) => p.replace(/\\/g, ''))
        : patterns;
    }
  }

  return matches;
};

micromatch.isMatch = (str, patterns, options) =>
  picomatch(patterns, options)(str);

module.exports = micromatch;
