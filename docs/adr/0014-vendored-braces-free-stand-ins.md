# ADR-0014: Vendored braces-free stand-ins for micromatch and fast-glob

## Status

Accepted (2026-10-23)

## Context

`braces` (GHSA-vfj7-8cjw-p6xm, CVE-2026-93687, CVSS 3.1 `A:H`) has a
stack-exhaustion DoS through deeply nested patterns. The OSV audit gate
(`scripts/ci/osv-audit.mjs`) fails on every HIGH, CRITICAL or UNKNOWN advisory
and has no exception path (#604, #607). So `braces` cannot stay in
`pnpm-lock.yaml`.

Only three packages pulled it in, all through `micromatch` (directly or via
`fast-glob`):

- `semantic-release` → `micromatch` (release workflow)
- `@semantic-release/commit-analyzer` → `micromatch` (dependency of
  `semantic-release`)
- `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` →
  `micromatch` (Next lint rules)

Each upstream route was tried and is closed (#608). Rechecked 2026-10-23:

| Route                                  | Result                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Override `braces` to a patched version | None exists: `first_patched_version` is `null`, the range is `<= 3.0.3`, and 3.0.3 is the latest `braces`.         |
| Newer `micromatch` / `fast-glob`       | `micromatch` 4.0.8 (latest) requires `braces ^3.0.3`; `fast-glob` 3.3.3 (latest) requires `micromatch ^4.0.8`.     |
| Older `micromatch` / `fast-glob`       | `micromatch@3` requires `braces ^2.3.1` and `fast-glob@2` requires `micromatch ^3.1.10`; the advisory covers both. |
| Newer dependent                        | Current, beta and canary releases of all three dependents still pull them (below).                                 |
| Drop the dependent                     | That would replace the release pipeline or the Next lint rules, which is out of scope for a dependency fix.        |

| Dependent                           | Version          | Requires            |
| ----------------------------------- | ---------------- | ------------------- |
| `semantic-release`                  | 25.0.9 (latest)  | `micromatch ^4.0.2` |
| `semantic-release`                  | 26.0.0-beta.2    | `micromatch ^4.0.2` |
| `@semantic-release/commit-analyzer` | 13.0.1 (latest)  | `micromatch ^4.0.2` |
| `@semantic-release/commit-analyzer` | 14.0.0-beta.4    | `micromatch ^4.0.2` |
| `@next/eslint-plugin-next`          | 16.4.2 (latest)  | `fast-glob 3.3.1`   |
| `@next/eslint-plugin-next`          | 16.5.0-canary.24 | `fast-glob 3.3.1`   |

Commands used:

```sh
gh api /advisories/GHSA-vfj7-8cjw-p6xm --jq '{withdrawn_at, vulnerabilities: [.vulnerabilities[] | {package: .package.name, vulnerable_version_range, first_patched_version}]}'
# {"vulnerabilities":[{"first_patched_version":null,"package":"braces","vulnerable_version_range":"<= 3.0.3"}],"withdrawn_at":null}
curl -sS https://api.osv.dev/v1/vulns/GHSA-vfj7-8cjw-p6xm   # affected: introduced 0, last_affected 3.0.3
npm view braces dist-tags.latest                            # 3.0.3
npm view micromatch dist-tags.latest dependencies.braces    # 4.0.8, ^3.0.3
npm view fast-glob dist-tags.latest dependencies.micromatch # 3.3.3, ^4.0.8
npm view micromatch@3 dependencies.braces                   # ^2.3.1
npm view fast-glob@2 dependencies.micromatch                # ^3.1.10
npm view semantic-release@latest version dependencies.micromatch
npm view semantic-release@beta version dependencies.micromatch
npm view @semantic-release/commit-analyzer@latest version dependencies.micromatch
npm view @semantic-release/commit-analyzer@beta version dependencies.micromatch
npm view @next/eslint-plugin-next@latest version dependencies.fast-glob
npm view @next/eslint-plugin-next@canary version dependencies.fast-glob
```

## Decision

Vendor minimal, braces-free stand-ins under `tools/braces-free/` and route
only the three dependents to them through scoped `pnpm-workspace.yaml`
overrides:

```yaml
'@next/eslint-plugin-next>fast-glob': file:tools/braces-free/fast-glob
'@semantic-release/commit-analyzer>micromatch': file:tools/braces-free/micromatch
semantic-release>micromatch: file:tools/braces-free/micromatch
```

- `tools/braces-free/micromatch` copies `micromatch()` and `isMatch()` from
  `micromatch@4.0.8` (MIT) on `picomatch`. Neither function uses `braces`. The
  brace-expansion helpers are left out, so any new caller fails loudly.
  `tools/braces-free/micromatch/LICENSE` is micromatch 4.0.8's license file
  byte for byte, with its copyright and permission notice
  (`Copyright (c) 2014-present, Jon Schlinkert.`).
- `tools/braces-free/fast-glob` implements the single
  `globSync(pattern, { onlyDirectories: true })` call that
  `@next/eslint-plugin-next` makes, on `tinyglobby`. That is its whole
  contract: it throws on a non-string pattern, on any other option, and on
  every other `onlyDirectories` value, including omitted options, `{}` and
  `{ onlyDirectories: false }`. File-globbing mode is not supported.
- `tests/scripts/braces-free-stand-ins.test.ts` resolves each stand-in the way
  its dependent does at runtime and checks it against captured
  `micromatch@4.0.8` / `fast-glob` results.
- `scripts/local/Dockerfile` copies `tools/braces-free` before
  `pnpm install`. `compose.yaml` watches it, and `eslint.config.mjs` allows
  `require()` in its CommonJS files.

## Removal trigger

When `braces` ships a release that GHSA-vfj7-8cjw-p6xm lists as
`first_patched_version`:

1. Delete `tools/braces-free/` and the three overrides above.
2. If the dependency chain resolves to the vulnerable version, add a security
   floor next to the others (`braces@<X: ^X`).
3. Delete `tests/scripts/braces-free-stand-ins.test.ts`, the Dockerfile `COPY`,
   the `compose.yaml` watch entries and the `eslint.config.mjs` block.
4. Run `pnpm install`, then the OSV audit. It must pass with no exceptions.

If a dependent drops `micromatch` / `fast-glob` first, remove only its
override and keep the rest until this trigger fires.

## Consequences

- `braces`, `micromatch` and `fast-glob` are absent from `pnpm-lock.yaml`, and
  the OSV gate keeps its no-exception rule.
- Linejam owns a small fork of two upstream APIs. A dependent upgrade that
  calls a new `micromatch` / `fast-glob` API fails loudly (missing function or
  rejected option) instead of drifting. The parity tests catch behaviour
  changes in the APIs it already uses.
- Dependabot cannot upgrade these stand-ins. Recheck the advisory when bumping
  `semantic-release` or `eslint-config-next`.

## Alternatives Considered

- **OSV exception for the advisory.** Rejected: #607 removed the gate's only
  exception path on purpose.
- **Override `micromatch` / `fast-glob` to another version.** Rejected: every
  published line pulls an affected `braces`.
- **Remove `semantic-release` or `eslint-config-next`.** Rejected for now: it
  replaces the release pipeline or the Next lint rules to fix one transitive
  dependency. A separate decision can revisit it.
- **pnpm `patchedDependencies` to strip `braces` from `micromatch`.** Rejected:
  `micromatch@4.0.8` calls `require('braces')` at module load, so the patch
  would have to rewrite the module body. That is a less visible fork of the
  same code that `tools/braces-free/micromatch` already owns explicitly.
