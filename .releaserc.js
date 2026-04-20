/**
 * Semantic Release Configuration
 *
 * Auto-versions based on conventional commits:
 * - feat: → minor version bump
 * - fix: → patch version bump
 * - feat!: or BREAKING CHANGE: → major version bump
 */
module.exports = {
  branches: ['master'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# Changelog\n\nAll notable changes to Linejam.',
      },
    ],
    // Prettier-format CHANGELOG.md immediately after it's regenerated so the
    // committed file matches `format:check` expectations — without this step,
    // every release lands an unformatted CHANGELOG and the next push fails
    // the format gate until a manual `style: prettier-format CHANGELOG.md`
    // commit lands. Runs between `changelog` (which writes the file) and
    // `git` (which commits `assets`), matching the prepare lifecycle phase.
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'pnpm prettier --write CHANGELOG.md',
      },
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false, // Don't publish to npm, just update package.json version
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json', 'pnpm-lock.yaml'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    '@semantic-release/github',
  ],
};
