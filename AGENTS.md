# Linejam

For every change, load the repo skill `verify-linejam`; keep
`features/README.md` as the shared navigation map. Retain actual proof in card
top-level artifacts and PR How to review.

Shared standard: [Constitution](https://foundations.mistystep.io/) and [Way of working](https://foundations.mistystep.io/way-of-working).
New code follows the [Misty Step Stack standard](https://foundations.mistystep.io/way-of-working).

Run `project-context linejam` before starting work on this project.
`PRODUCT.md` is the Active Folio: what Linejam is and must do. `DESIGN.md` and
the checksum-locked `folio/assets/` own the visual identity. `SPEC.md` keeps
detailed observable acceptance. Powder owns priorities, open questions and
decisions in flight; historical issues are context, not an automatic queue.

## Authority

- State the goal, files/systems in scope, and live authority before mutation.
- Preserve user work: inspect `git status`, never overwrite unrelated changes,
  and never use destructive Git commands.
- Never edit `PRODUCT.md`, `DESIGN.md` or `folio/assets/**` as part of an
  implementation change. They change only through a Folio change, which also
  updates `folio/assets/checksums.json`.
- Base branch: `master`. Commits and PR titles use Conventional Commits.

## Sources of truth

| Concern                          | Source                                                         |
| -------------------------------- | -------------------------------------------------------------- |
| Product rules                    | `PRODUCT.md`, then `SPEC.md` for detail                        |
| Visual identity                  | `DESIGN.md`, `folio/assets/` (`checksums.json`, `tokens.json`) |
| Game rules in code               | `shared/rules.ts` — the only definition, used by every face    |
| Room state and real time         | `src/room.ts` (`RoomDO`)                                       |
| Archive, sharing, retention      | `src/archive.ts` (`ArchiveDO`)                                 |
| Routes, identity, headers        | `src/worker.ts`, `src/auth.ts`                                 |
| Deployment contract              | `wrangler.jsonc`, `docs/operations.md`                         |
| Architecture                     | `docs/architecture.md`                                         |
| Tests and acceptance             | `docs/testing.md`, `vitest.config.ts`, `e2e/walkthrough.mjs`   |
| CLI / MCP                        | `docs/agent-faces.md`, `.agents/skills/linejam-cli/SKILL.md`   |
| Foundation checks and story walk | `.agents/skills/verify-linejam/SKILL.md`, `features/`          |

The live stack is declared in `package.json` and `wrangler.jsonc`; do not copy
dependency versions or test counts into agent prose.

## One runtime

Linejam is one Cloudflare Worker with Durable Objects (SQLite). Do not add a
second runtime, framework server, external database, analytics or error SDK,
or any request to another origin from the browser. The generated files in
`dist/public` and `web/src/generated` come only from `scripts/build.mjs`.

## Authority boundaries

- Read-only investigation, focused checks, and requested worktree edits are
  local actions. External writes need task or operator authority.
- Start long-running processes only when commissioned, with a named shutdown
  and monitoring owner.
- Production deploys, secret changes, the legacy data import, enabling
  retention deletion, and removing the sealed `LinejamBackend` class each need
  explicit authority for that operation (`docs/operations.md`). A configured
  target or flag does not grant it.
- Never expose credentials or value-bearing environment listings. A guest
  token is a credential, including CLI output on stderr.

## Domain invariants

- `GUEST_TOKEN_SECRET` signs every guest credential. Keep its production value
  stable; rotating it logs every guest out of their seats and archive.
- An accepted line is immutable; retries return the stored line.
- Hidden poem text never leaves `RoomDO`: views carry lines only after reveal,
  and a writer's assignment carries only the immediately preceding line.
- A poem is private until a share link is confirmed, and private again when it
  is revoked. An identifier alone never authorizes a read.
- The `LinejamBackend` export and its `linejam-backend-v1` migration tag stay
  until an operator decides otherwise: removing them deletes pre-recompile
  player data on the next deploy.

## Acceptance and evidence

Done means verified on the real running path: `pnpm verify` (which ends with
the headed two-player walkthrough against live `wrangler dev`), not tests or a
green CI run alone. Documentation-only work does not require an application
suite merely to prove prose.

CLI/MCP behavior is not proof of the rendered player experience.

Before handoff, adversarially review the diff for stale claims, authority
ambiguity, accidental scope, secret exposure, and safety regressions. Record
exact commands, exercised surfaces, and unverified risk. Review, merge, deploy,
monitor, and production verification are distinct operations, each requiring
its own authorized scope. Run `upkeep where <task-kind>` before dispatching.

## No fallbacks

No fallbacks, backup paths or masking safety nets. Write the one best solution: direct, clean, simple, elegant. If it fails, it must fail loudly and visibly so we can fix it. Security checks (auth, signatures, schema validation) stay, but fail loudly, never silently.

## Pooled accounts

Pooled accounts: all subscriptions and AI accounts (personal, Misty Step, R90) are pooled for all work in every direction. When one is exhausted (e.g. codex-r90 out of credits), switch to another pooled account; never stop, downgrade or buy credits.
