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
