# Linejam

For every change, load the existing repo skill `verify-linejam`; keep `features/README.md` as the shared navigation map. Retain actual proof in card top-level artifacts and PR How to review. New Hermes profiles enable project skills with `hermes skills trust` after reviewing the checkout.

Shared standard: [Constitution](https://foundations.mistystep.io/) and [Way of working](https://foundations.mistystep.io/way-of-working).
New code follows the [Misty Step Stack standard](https://foundations.mistystep.io/way-of-working).

Run `project-context linejam` before starting work on this project.
Use `SPEC.md` for observable behavior, `project.md` for the product brief, and
`DESIGN.md` for identity and interaction. Powder owns priorities, open questions
and decisions in flight; historical issues are context, not an automatic queue.

## Authority

- State the goal, files/systems in scope, and live authority before mutation.
- Preserve user work: inspect `git status`, never overwrite unrelated changes,
  and never use destructive Git commands.
- Work from the operator's current request. Check current code and overlapping
  work before implementation. Kanban owns work in flight, GitHub owns PRs, CI and
  inbound issues, and Overmind owns health. Powder owns priority, not a second queue
  in this repository.
- Base branch: `master`. Commits and PR titles use Conventional Commits.

## Sources of truth

| Concern                                       | Source                                                              |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Behavior and architecture                     | `SPEC.md`, `project.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`        |
| Data/API                                      | `convex/schema.ts`, `convex/_generated/api.d.ts`                    |
| Assignment rules                              | `convex/lib/assignmentMatrix.ts`, `convex/lib/gameRules.ts`         |
| Tests and QA                                  | `docs/testing.md`, `vitest.config.ts`, Playwright configs           |
| Isolated runtime and multiplayer verification | `docs/local-development.md`, `.agents/skills/play-linejam/SKILL.md` |
| Foundation checks and story walks             | `.agents/skills/verify-linejam/SKILL.md`, `features/`               |
| CI and live-operation authority               | `docs/ops/observability-ci.md`, `scripts/ci/dagger-call.sh`         |
| Production operations                         | `docs/deployment.md`                                                |
| Data retention                                | `docs/ops/data-retention.md`, `convex/lib/retentionPolicy.ts`       |
| Convex environment contract                   | `config/convex-env-manifest.json`                                   |
| Schema migration sequencing                   | `docs/convex-migrations.md`                                         |
| DigitalOcean topology contract                | `config/digitalocean-apps.json`, `pnpm ops:do-drift`                |
| Agent CLI/MCP                                 | `.agents/skills/linejam-cli/SKILL.md`, `docs/agent-faces.md`        |

The live stack is declared in `package.json`; do not copy dependency versions
or test counts into agent prose.

## Authority boundaries

- Read-only investigation, focused checks, and requested worktree edits are
  local actions. External writes need task or operator authority.
- Start long-running processes only when commissioned, with a named shutdown
  and monitoring owner.
- Bounded shared-development work uses the fail-closed
  `pnpm convex:sync:shared-dev` flow in `docs/ops/observability-ci.md`, not a bare
  deploy. Read-only function probes and scoped dev migrations follow the same
  target, redaction, and postcondition rules.
- Production deploys, data writes, environment changes, smoke triggers, merges,
  and provider mutations require explicit authority for that operation. A
  configured target or safety flag does not grant authority. Keep production
  guards enabled.
- Never expose credentials or value-bearing environment listings.
  `docs/ops/observability-ci.md` owns bounded, values-free environment readback;
  `docs/deployment.md` owns release operations.

## Domain invariants

- `GUEST_TOKEN_SECRET` must match the web and target Convex deployment. Guest
  tokens are credentials, including CLI create/join output on stderr.
- Production rolling deploys bind `NEXT_DEPLOYMENT_ID` to the source commit
  and reuse one stable 32-byte base64 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
  Never rotate that key as part of a normal release.
- Convex scheduler/database verification uses `setupConvexTest()`. Keep
  database work bounded and avoid per-record query/write loops.
- Preserve retention and migration sequencing contracts in
  `docs/ops/data-retention.md` and `docs/convex-migrations.md`.

## Acceptance and evidence

Use change-scoped acceptance in `docs/testing.md`; documentation-only work
does not require an application suite merely to prove prose. The pre-push
policy in `CONTRIBUTING.md` remains in force, and the hosted
`.github/workflows/ci.yml` merge gate is authoritative. Full Dagger/browser
acceptance needs the relevant environment and operation authority.

When coverage runs, all four metrics must have nonzero totals and pass
`coverage:check`; `0/0 Unknown%` is failure in every checkout location.

CLI/MCP behavior is not proof of the rendered player experience.
`docs/agent-faces.md` separates those surfaces; use `play-linejam` for
commissioned complete multiplayer browser verification, not every UI edit.
Only observed completion, room closure, fresh-session rejection, session
cleanup, and inspected run-local artifacts can support its pass receipt.

Before handoff, adversarially review the diff for stale claims, authority
ambiguity, accidental scope, secret exposure, and safety regressions. Keep
raw or sensitive run output in approved retained artifact storage, not
repository fixtures. Share sanitized, revision-specific conclusions and
links in Kanban or the PR. Record exact commands, exercised surfaces, and
unverified risk. Review, merge, deploy, monitor, and production verification
are distinct operations, each requiring its own authorized scope.

## No fallbacks

No fallbacks, backup paths or masking safety nets. Write the one best solution: direct, clean, simple, elegant. If it fails, it must fail loudly and visibly so we can fix it. Security checks (auth, signatures, schema validation) stay, but fail loudly, never silently.

## Pooled accounts

Pooled accounts: all subscriptions and AI accounts (personal, Misty Step, R90) are pooled for all work in every direction. When one is exhausted (e.g. codex-r90 out of credits), switch to another pooled account; never stop, downgrade or buy credits.
