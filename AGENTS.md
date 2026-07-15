# AGENTS.md — Linejam

Compact router for repository agents. Read only the depth your lane needs.

## Start here

- State the goal, files/systems in scope, and live authority before mutation.
- Read `VISION.md` and `project.md` before changing product direction.
- Preserve user work: inspect `git status`, never overwrite unrelated changes,
  and never use destructive Git commands.
- Powder is the only ledger. Before implementation, run
  `source ~/.secrets`, `/usr/bin/env powder list-ready --repo linejam`, then
  claim one shaped card as the authenticated actor. Keep its run current and
  complete or release it; never create a repository-local ticket store.
- Base branch: `master`. Commits and PR titles use Conventional Commits.

## Sources of truth

| Concern                         | Source                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| Product and architecture        | `VISION.md`, `project.md`, `docs/ARCHITECTURE.md`            |
| Data/API                        | `convex/schema.ts`, `convex/_generated/api.d.ts`             |
| Assignment rules                | `convex/lib/assignmentMatrix.ts`, `convex/lib/gameRules.ts`  |
| Tests and QA                    | `docs/testing.md`, `vitest.config.ts`, Playwright configs    |
| CI and live-operation authority | `docs/ops/observability-ci.md`, `scripts/ci/dagger-call.sh`  |
| Production operations           | `docs/deployment.md`                                         |
| Convex environment contract     | `config/convex-env-manifest.json`                            |
| Schema migration sequencing     | `docs/convex-migrations.md`                                  |
| DigitalOcean topology contract  | `config/digitalocean-apps.json`, `pnpm ops:do-drift`         |
| Agent CLI/MCP                   | `.agents/skills/linejam-cli/SKILL.md`, `docs/agent-faces.md` |

The live stack is declared in `package.json`; do not copy dependency versions
or test counts into agent prose.

## Authority boundaries

- Read-only inspection, focused tests, and requested worktree edits are local
  lane actions. External writes need authority from the task or operator.
- Do not start long-running processes (`pnpm dev`, `pnpm dev:convex`,
  `pnpm start:next`, responders, watch modes, MCP servers) unless the lane
  explicitly commissions that process and names its shutdown/monitoring owner.
- Authorized bounded shared-development work is allowed. For a one-shot Convex
  code sync, use the fail-closed `pnpm convex:sync:shared-dev` flow documented
  in `docs/ops/observability-ci.md`; do not substitute a bare deploy command.
  Read-only `function-spec` probes and explicitly scoped dev migrations follow
  the same target, redaction, and postcondition rules.
- Production deploys, data writes, environment changes, smoke triggers, merges,
  and provider mutations require explicit live authority for that operation.
  Keep production guards enabled; a flag is a safety condition, not authority.
- Never print, paste, commit, or persist credentials. Avoid value-bearing env
  listings. Use `pnpm convex:env:reconcile` for development or
  `node scripts/ci/reconcile-convex-env.mjs --target production` for a bounded,
  values-free production readback.

## Engineering invariants

- Work red → green → refactor for behavior changes. Build the real acceptance
  loop first; unit tests alone do not prove browser, scheduler, or deployment
  behavior.
- Fix causes at the highest-leverage layer. Do not weaken tests, coverage,
  lint, hooks, auth, allowlists, or fail-closed deployment checks to get green.
- Mock external systems and nondeterminism, not the behavior under test. Convex
  scheduler/database behavior uses `setupConvexTest()`.
- Parallelize independent Convex reads/writes; avoid sequential write loops and
  N+1 queries. Every `while` loop needs an explicit bound.
- `GUEST_TOKEN_SECRET` must match the web and target Convex deployment. Treat
  guest tokens as credentials.
- Production rolling deploys require `NEXT_DEPLOYMENT_ID` bound to the source
  commit and one stable 32-byte base64 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
  Never rotate that key as part of a normal release.
- Never bypass hooks with `--no-verify`. Never push when `pnpm ci:prepush` is
  red. Never claim validation without the exact command and exercised surface.

## Delivery and evidence

Run the narrowest useful check while editing, then the change-type acceptance
in `docs/testing.md`. `pnpm ci:prepush` is the required fast local gate;
GitHub's `.github/workflows/ci.yml` merge gate is authoritative for merge.
Use `pnpm ci:dagger:all` only when the full Docker/browser contract is relevant
and its required environment is available.

`pnpm test:ci` must report nonzero totals for all four 85% metrics and pass the
explicit `coverage:check` guard. A `0/0 Unknown%` result is a hard failure in
every checkout path, including isolated harness worktrees.

Before handoff, adversarially review the diff for stale claims, authority
ambiguity, accidental scope, secret exposure, and safety regressions. Record
exact tests, live evidence, residual risk, and commit/PR/deployment identifiers
in Powder. Review, merge, deploy, monitor, and production verification are
distinct acceptance surfaces; perform only the ones authorized by the lane.
