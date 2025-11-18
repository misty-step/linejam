# Changesets

This folder contains changeset files that track changes for versioning.

## Adding a changeset

Run `pnpm changeset` to create a new changeset when you make a change that should be released.

## Release process

1. Changes accumulate as changeset files in this directory
2. GitHub Action creates a "Version Packages" PR when changesets exist
3. Merging that PR bumps versions and updates CHANGELOG.md
