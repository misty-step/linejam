---
name: deps
description: |
  Patch Linejam dependencies. Audit via osv-scanner (pnpm 10.22), ship one
  fix(deps): PR per advisory cluster, verify through the Dagger gate.
  Use when: "upgrade deps", "dependency audit", "check for updates",
  "outdated packages", "security audit deps", "update dependencies",
  "vulnerable dependencies", "deps", "audit is red", "advisory".
  Trigger: /deps.
argument-hint: '[audit|security|upgrade <pkg>|report]'
---

# /deps

Patch Linejam dependencies. Audit via osv-scanner, ship one `fix(deps):` PR
per advisory cluster, verify through `pnpm ci:prepush`.

**Target:** $ARGUMENTS

## Execution Stance

You are the executive orchestrator.

- Keep upgrade policy, risk acceptance, and final merge-readiness judgment on
  the lead model.
- Delegate per-advisory analysis (changelog read, reachability trace) to
  focused subagents when the cluster has ≥3 packages. Below that, act directly
  — spawning a subagent to run `pnpm why protobufjs` is pure overhead.
- Parallelize per-package analysis only; upgrades and tests run serially so
  the lockfile diff stays legible.

## Fix-everything-on-encounter

Audit red in any session = patch in that session. Don't defer, don't file
"pre-existing, not my scope." The feedback doctrine in
`feedback_fix_everything_on_encounter.md` is explicit: patch gates and
advisories as encountered. This skill is the canonical execution path.

## The Linejam Audit Surface

**Audit runs via `osv-scanner`, not `pnpm audit`.** Commit `6a76039` replaced
`pnpm audit` because npm retired the legacy `/-/npm/v1/security/audits`
endpoint (HTTP 410) that pnpm 10.x still calls. Do not propose re-introducing
`pnpm audit` — it is permanently broken on this stack.

The authoritative audit command is:

```bash
pnpm ci:dagger:audit
```

Which `dagger/src/index.ts` implements as: `ghcr.io/google/osv-scanner:v2.0.2`
in a container, scanning `pnpm-lock.yaml` against OSV.dev, failing on HIGH or
CRITICAL only (preserving prior `--audit-level=high` semantics). MODERATE and
LOW are reported but do not gate.

Gotchas specific to this audit lane:

- **Dependabot lies.** Cross-reference every Dependabot alert against
  `pnpm-lock.yaml` before acting. Commit `dc8f4e2` found 40/40 Dependabot
  alerts were stale (already patched via overrides); Dependabot re-closes on
  next rescan. osv-scanner is authoritative.
- **Canary keys must be real.** Invariant #4 from the repo brief:
  `NEXT_PUBLIC_CANARY_ENDPOINT` and `NEXT_PUBLIC_CANARY_API_KEY` must be real
  values in any build-bearing Dagger lane. The audit lane itself doesn't
  compile the app, but follow-up `pnpm ci:prepush` does.

## The Linejam Override Pattern

Transitive advisories patch via `pnpm.overrides` in `package.json`. Current
overrides (as of 2026-04-20) — do not remove without evidence the advisory
cleared:

```jsonc
"pnpm": {
  "overrides": {
    "@clerk/shared@3": "^3.47.4",   // GHSA-vqx2-fgx2-5wq9 floor for v3.x
    "@clerk/shared@4": "^4.8.1",    // GHSA-vqx2-fgx2-5wq9 floor for v4.x
    "ajv@6":           "^6.14.0",   // GHSA-2g4f-4pwh-qvx6 ReDoS (eslint v6 line)
    "flatted":         "3.4.2",
    "handlebars":      "4.7.9",
    "lodash":          "4.18.1",
    "lodash-es":       "4.18.1",
    "minimatch":       "10.2.5",
    "picomatch":       "4.0.4",
    "protobufjs":      "^7.5.5",    // CVE-2026-41242 (posthog-js → OTel chain)
    "rollup":          "4.59.0",
    "undici":          "7.24.0",
    "vite":            "7.3.2"
  }
}
```

Scoped overrides (`@clerk/shared@3` vs `@clerk/shared@4`) pin per major line.
Use this when two majors coexist in the tree and you need a floor on each.
Before adding an override, try a direct bump first — overrides are pins on
transitives, not a substitute for upgrading the direct dependent.

## Infra Dependency Discipline

These are load-bearing. Upgrades are not drive-by — they get their own slice:

| Package         | Current   | Why not drive-by                                                  |
| --------------- | --------- | ----------------------------------------------------------------- |
| `@clerk/nextjs` | `^6.39.2` | Auth surface. Major bump = auth regression risk.                  |
| `convex`        | `^1.31.7` | Generated API surface (`convex/_generated/api.d.ts`) drifts.      |
| `next`          | `16.2.3`  | App Router contract; `eslint-config-next` pinned to match.        |
| `react`         | `19.2.4`  | React 19 canary behaviors load-bear on Convex `useQuery` pattern. |
| `tailwindcss`   | `^4`      | Tailwind 4 engine; theme system in `lib/themes/` coupled to it.   |
| `vitest`        | `^4.0.18` | Test pool is `threads, maxWorkers: 1` — see brief gotcha #7.      |

For these, stop after Phase 2 and surface the upgrade to the user as its own
decision. Do not fold an infra major into a `fix(deps):` PR.

**OpenRouter / AI model pinning.** `convex/ai.ts:286` resolves the model as
`process.env.AI_MODEL || 'google/gemini-3-flash-preview'`. Model pinning is
configuration, not a package version — changing the default requires a product
conversation, not a deps PR. If an OpenRouter-side model is deprecated and
the AI lane starts failing, that is a product slice, not a deps patch.

## Routing

| Mode                | Intent                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| **audit** (default) | Run `pnpm ci:dagger:audit`, patch every HIGH/CRITICAL, ship the PR.     |
| **security**        | Same as audit (osv-scanner is security-gated already by HIGH/CRITICAL). |
| **upgrade** [pkg]   | Targeted: upgrade a named package with full analysis.                   |
| **report**          | Run audit, produce the report, create no branch.                        |

## Workflow

Five phases, gated. Each phase must complete before the next begins.

### Phase 0: Baseline

`pnpm ci:prepush` on clean `HEAD`. If the gate is already red and the failure
is _not_ an audit advisory, **STOP** and surface the failure — you cannot
attribute regressions to your upgrades if the baseline is already red.

If the baseline is red _because of_ an audit advisory, proceed — fixing that
advisory is the job.

Gate: Dagger baseline understood (green, or red-but-audit-only).

### Phase 1: Discover

```bash
pnpm ci:dagger:audit
```

osv-scanner emits JSON at `/tmp/osv.json` inside the container and a table to
stdout. Parse the output for every HIGH and CRITICAL. For each:

```bash
pnpm info <pkg>            # published versions, latest, advisories
pnpm why <pkg>             # who pulls it (direct vs transitive)
pnpm list <pkg> --depth=Infinity   # resolved version in tree
```

Categorize:

- **Direct dep, in-semver patch available** → bump directly.
- **Direct dep, cross-semver patch required** → `pnpm add <pkg>@<safe>` and
  flag as infra if it's in the "Infra Dependency Discipline" table.
- **Transitive, dependent already patched upstream** → bump the dependent.
- **Transitive, upstream unpatched** → `pnpm.overrides` with the safe floor.

Gate: every HIGH/CRITICAL has a categorization and a proposed remedy.

### Phase 2: Analyze

For every proposed remedy, produce three verdicts. Parallelize across
packages only if the cluster is ≥3 packages.

**Changelog.** Read release notes between current and target. For direct
bumps in Clerk/Convex/Next/React/Tailwind, escalate immediately — do not
absorb infra changes into a deps PR. Verdict:
`migration_required: yes | no | unknown`.

**Reachability.** Trace import chains to CVE-affected functions. See
`references/reachability-analysis.md`. For Convex/Clerk/Next packages,
reachability is almost always "yes" — they sit in hot paths. For transitive
CVEs (e.g., `protobufjs` via posthog OTel chain) reachability is typically
"no in app code, yes in analytics transport." Note the distinction. Verdict:
`reachable | not reachable | unknown`.

**Behavioral.** Check for new install scripts, new network calls,
permission/API changes. See `references/behavioral-diff.md`. Verdict:
`risk: critical | high | medium | low`.

Gate: every remedy has all three verdicts. Any `unknown` reachability on
CRITICAL advisories → investigate deeper or escalate.

### Phase 3: Patch

Branch name:

```bash
git checkout -b fix/patch-<cluster>-advisories
# e.g. fix/patch-clerk-protobufjs-advisories
```

Apply remedies in this order (one commit per cluster, not per package —
Linejam's shipping cadence is _cluster-per-PR_):

1. **Direct bumps** — `pnpm add <pkg>@<version>` or edit `package.json` +
   `pnpm install`.
2. **Overrides** — add entry to `pnpm.overrides`, run `pnpm install`.
3. **Lockfile commits the result** — `pnpm-lock.yaml` diff must be part of
   the same commit.

Commit message format (Conventional Commits, enforced by commitlint):

```
fix(deps): patch <packages> <severity> advisories

<advisory list with GHSA / CVE IDs, CVSS, one-line description each>

Direct bumps:
  - <pkg> <old> → <new>  (<reason>)

pnpm overrides (belt-and-suspenders for transitives):
  - <pkg> → <floor>  (<dependent chain>)

Verified with `pnpm ci:dagger:audit` — no HIGH or CRITICAL remaining.
```

See `55814b4` (clerk + protobufjs) and `dc8f4e2` (dompurify + ajv) for the
canonical shape. Follow it exactly.

Gate: branch contains one atomic commit per cluster, Conventional Commits
formatted, lockfile diff bundled in.

### Phase 4: Verify

```bash
pnpm ci:dagger:audit       # MUST report zero HIGH/CRITICAL
pnpm ci:prepush            # full Dagger gate
```

The audit lane alone is not enough — a transitive bump can break build, lint,
or tests. If `pnpm ci:prepush` fails, the upgrade is the prime suspect.
Bisect within the cluster: revert one package at a time, reproduce, identify
the offender.

If an advisory cannot be patched without breaking the gate:

- Document it in the PR body.
- File a `backlog.d/NNN-*` slice with Goal + Oracle to unblock.
- Ship the partial fix (other advisories in the cluster) rather than holding
  the whole PR.

Never push on red Dagger. Never `--no-verify`. Invariant #1 from the repo
brief is absolute.

Gate: `pnpm ci:dagger:audit` green, `pnpm ci:prepush` green.

### Phase 5: Report

Open the PR against `master`:

```bash
gh pr create --title "fix(deps): patch <packages> <severity> advisories" \
  --body "$(cat <<'EOF'
## Summary

Patched N HIGH/CRITICAL advisories flagged by osv-scanner.

## Advisories

| Advisory | Package | CVSS | Action |
| -------- | ------- | ---- | ------ |
| GHSA-xxxx | <pkg> | 9.4 | Bumped `<old>` → `<new>` |
| GHSA-yyyy | <pkg> | 9.1 | Override floor `<pkg> → <version>` |

## Reachability

- `<pkg>` — <reachable | not reachable, with file pointer>
- `<pkg>` — <reachable | not reachable, with file pointer>

## Verification

- `pnpm ci:dagger:audit` — no HIGH or CRITICAL remaining
- `pnpm ci:prepush` — green

EOF
)"
```

For **report** mode: produce the above body as assistant output, create no
branch.

## Subagent Dispatch

When a cluster has ≥3 advisories or crosses a load-bearing package, delegate
per-advisory analysis in parallel. Available agents under
`.claude/agents/`:

- `critic` — second-pass review of the upgrade cluster before PR open.
- `ousterhout` — interface stability review for any infra-tier bump.
- `grug` — sanity check on whether an override is masking a deeper problem
  that a direct bump would solve.
- `carmack` — perf/regression eyes when the bump touches hot paths
  (Convex queries, render path, auth).

Do not dispatch `planner` or `builder` for a deps patch — this skill _is_
the plan and the build.

## Gotchas

- **Proposing `pnpm audit`.** Broken on this stack since commit `6a76039`.
  Use `pnpm ci:dagger:audit` (osv-scanner) every time.
- **Acting on Dependabot alerts without cross-checking.** Commit `dc8f4e2`
  documented 40/40 stale Dependabot alerts — overrides already patched them.
  osv-scanner is the authority.
- **Folding an infra major into a deps PR.** Clerk 6 → 7, Convex 1.x → 2,
  Next 16 → 17, React 19 → 20, Tailwind 4 → 5 — each is its own slice. Stop
  after Phase 2 and hand the decision back.
- **Removing a `pnpm.overrides` entry without verifying the advisory cleared
  upstream.** The overrides are floors, not decoration. Every entry maps to
  a known advisory; check the corresponding `fix(deps):` commit before
  removing.
- **Upgrading without testing Playwright coverage.** `pnpm ci:prepush` runs
  E2E including authenticated Clerk flows. A Clerk patch that passes unit
  tests can still break the sign-in smoke.
- **Ignoring MODERATE/LOW forever.** The gate is HIGH/CRITICAL only, but
  accumulated MODERATE advisories become a backlog slice. Scan the
  `osv-scanner ... --format=table` output in Phase 1 and file a slice if
  MODERATE count is non-trivial.
- **Missing the lockfile in the commit.** Every `pnpm install` after a
  `package.json` change touches `pnpm-lock.yaml`. Both files go in one commit
  or the PR is structurally broken.
