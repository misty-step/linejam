---
name: implement
description: |
  Atomic TDD build skill for linejam. Takes a context packet (from /shape) and
  produces code + Vitest/Playwright tests on a feature branch. Red → Green →
  Refactor against the repo's inner loop: `pnpm test --run <path>` for fast
  feedback, `pnpm ci:prepush` before merge-ready.
  Does not shape, review, QA, or ship — single concern: spec to green tests.
  Use when: "implement this spec", "build this", "TDD this", "code this up",
  "write the code for this ticket", after /shape has produced a context packet.
  Trigger: /implement, /build (alias).
argument-hint: '[context-packet-path|backlog-id]'
---

# /implement (linejam)

Spec in, green tests out. One packet, one feature branch, one concern. TDD
against Vitest (unit/integration) or Playwright (E2E) with **`pnpm ci:prepush`**
as the final gate.

## Invariants

- Trust the context packet. Do not reshape. Do not re-plan.
- If the packet is incomplete, **fail loudly** — do not invent the spec.
- **Mock at system boundaries only.** Never mock `@/` or `../../` paths.
  (Repo-brief Invariant #5 / CLAUDE.md mocking rules.)
- **Never run `convex dev` yourself.** The user keeps Convex + Next dev
  servers running in a separate terminal. If `convex/_generated/api.d.ts`
  drifts, ask the user to run `pnpm dev:convex` — don't spawn it.
  (Repo-brief Invariant #2 / Gotcha #1.)
- **Don't change the Vitest pool config speculatively.** It is pinned to
  `threads` with `maxWorkers: 1` to dodge a Node 22 forks-teardown hang.
  If your new tests hang, debug per `CLAUDE.md` "Debugging Test Hangs" —
  do not flip to `forks` or raise `maxWorkers`. (Gotcha #7.)

## Contract

**Input.** A context packet: goal, non-goals, constraints, repo anchors,
oracle (executable preferred), implementation sequence. Resolution order:

1. Explicit path argument (`/implement backlog.d/005-add-request-telemetry-for-room-flows.md`)
2. Backlog ID (`/implement 005`) → resolves via `backlog.d/<id>-*.md`
3. Last `/shape` output in the current session
4. **No packet found → stop.** Do not guess the spec from a title.

Required packet fields (hard gate — missing any = stop):

- `goal` (one sentence, testable)
- `oracle` (how we know it's done, executable commands preferred)
- `implementation sequence` (ordered steps, or the literal phrase "single chunk")

See `references/context-packet.md` for the full shape.

**Output.**

- Code + tests on a feature branch (`<type>/<slug>` from current branch)
- All tests green (new + existing) via `pnpm test --run <path>` on touched
  files and `pnpm ci:prepush` at exit
- Working tree clean (no debug prints, no scratch files)
- Commits in Conventional Commits format (commitlint enforces) — one
  logical unit per commit
- Final message: branch ref + oracle checklist status

**Stops at:** green tests + clean tree. Does not run `/code-review`,
`/qa`, `/ci`, or open a PR.

## Inner Loop

Per behavior in the implementation sequence:

1. **Read the context packet, then the repo anchors.** Grep existing tests
   for the feature area (`tests/**/*.test.ts(x)` for Vitest,
   `tests/e2e/*.spec.ts` for Playwright) — follow their patterns exactly.
2. **Red.** Write one failing test for one behavior. Pick the layer:
   - **Pure logic / lib / hooks / Convex helpers** → Vitest, Node env by default.
   - **React components** → Vitest + `// @vitest-environment happy-dom` header,
     `@testing-library/react`. `tests/setup.ts` already shims `localStorage`
     and `sessionStorage` as in-memory Maps (Node 22 exposes a partial webstorage
     global that breaks happy-dom — don't re-shim).
   - **Convex queries/mutations/actions** → Vitest with current mocking pattern
     (see `tests/convex/*.test.ts`). `convex-test` is installed but not yet
     wired (see `tests/convex/game-convex-test-example.test.ts` for the
     `import.meta.glob` blocker). Until that infrastructure work lands, match
     the surrounding file's current approach.
   - **End-to-end user flow** → Playwright in `tests/e2e/*.spec.ts`.
     `tests/e2e/guest-flow.evidence.spec.ts` is the authoritative client-side
     QA spec; follow its shape for guest-path coverage.
3. **Run it red.** `pnpm test --run <path/to/new.test.ts>`. Confirm the
   failure message matches the expected reason — not a typo, not an import
   error, not a missing mock. A test red for the wrong reason is a false red.
4. **Green.** Minimum production code to make the test pass. Not elegant —
   minimum. Refactor pass is next.
5. **Verify types and unit runs clean.**
   - `pnpm typecheck` (app + Dagger) or `pnpm ci:dagger:typecheck` in a
     container.
   - `pnpm test --run <path>` green.
6. **Refactor.** Kill duplication in the code you just wrote. Tests stay
   green — if refactor turns red, revert. Scope is local; broader cleanup
   is `/refactor`'s job.
7. **Commit.** Conventional Commits, one logical unit. Message names the
   behavior (`feat: reject lines exceeding round word cap`), not the mechanic.

Then: next behavior. Never two reds in a row.

## Pre-Exit Gate

Before handing off:

- [ ] Every oracle command exits 0 (run them — don't trust the builder).
- [ ] `pnpm test:ci` green locally (spot-check coverage; threshold is **85%**
      lines/branches/functions/statements, enforced by `vitest.config.ts`).
- [ ] `pnpm ci:prepush` green — this is the authoritative gate (= `pnpm
ci:dagger:all`: lint, format-check, typecheck, audit, build-check,
      unit-test with coverage, secret-scan, Playwright E2E).
- [ ] `git status` clean, no `TODO`/`FIXME`/`console.log` added outside spec.
- [ ] Commits atomic and Conventional Commits–compliant.

If any check fails, dispatch a builder sub-agent to fix. Max 2 fix loops,
then escalate.

## Where Tests Live

- **Unit / integration (Vitest).** Co-located `*.test.ts(x)` next to the
  module under test, or under `tests/<feature>/`. React components live in
  `tests/components/`, Convex functions in `tests/convex/`, shared libs in
  `tests/` root.
- **E2E (Playwright).** `tests/e2e/*.spec.ts`. Evidence-grade guest flow is
  `tests/e2e/guest-flow.evidence.spec.ts` — authoritative for client-side QA.
  Prod-smoke (`prod-smoke.spec.ts`) is ignored by default Playwright config.

## Convex Function TDD

- Schema source of truth: `convex/schema.ts`. API surface:
  `convex/_generated/api.d.ts` (regenerated on `convex dev` / `pnpm build`).
- If you change `convex/schema.ts`, `convex/*.ts` function signatures, or
  add a new file under `convex/`, the generated types will drift. Ask the
  user to run `pnpm dev:convex` so codegen catches up — do not spawn
  `convex dev` yourself (Invariant #2).
- Tests follow the existing file's pattern. `tests/convex/*.test.ts` uses
  manual mocking today; `convex-test` is installed but blocked on Vite
  environment config (see `game-convex-test-example.test.ts`). Don't
  migrate a file to `convex-test` inside `/implement` unless the packet
  explicitly says so — that is separate infrastructure work.
- **Never mock `@/convex/lib/*` internal helpers** (`auth.ts`,
  `assignmentMatrix.ts`, `wordCount.ts`, etc.). Mock only `convex/react`,
  `@clerk/nextjs`, `fetch`, `localStorage`, `clipboard`, `Date.now`,
  `Math.random`. If a test needs to isolate internal collaborators, the
  module under test is probably too big — raise as a blocker.
- **Parallel DB writes.** When a mutation loops over items, use
  `Promise.all`. N+1 query patterns get batched via `q.or()` — your tests
  should still pass after the batching, so write them against the
  behavior, not the implementation. (Invariant #6.)
- **Loop safety.** Every `while` loop you add needs a termination guard
  (`attempts < MAX_ATTEMPTS`). Unbounded loops have cost real time to
  debug in past sessions. (Invariant #7.)

## Terminology (use exactly these)

- **Poem**, not document/entry. **Line**, not submission/message.
- **Round**, not step/phase (rounds 0–8, nine total).
- **Assignment matrix**, not schedule/rotation. **Cycle**, not session.
- **Pen name**, not display name (captured on the line at write-time).
- **Guest UUID** / **guest token**, not anonymous ID.
- **Host**, not owner. **Room code**, four-letter, formatted `AB CD`.
- **Reveal phase**, not endgame.
- **Dagger / Dagger lane**, not "the CI" generically.

## Dispatch

Spawn a **builder** sub-agent from the configured agent roster with:

- The full context packet
- The executable oracle
- The TDD mandate (below)
- This skill's mocking + loop-safety + Convex-codegen invariants (quote them)
- File ownership. If the packet decomposes into disjoint chunks, spawn
  multiple builders in parallel — one per chunk, each with its subset of
  oracle. Shared files → serial builders.

**Builder prompt must include:**

> You MUST write a failing test before production code.
> RED → GREEN → REFACTOR → COMMIT. Exceptions: config files, generated code,
> UI layout. Document any skipped-TDD step inline in the commit message.
> Run `pnpm test --run <path>` after each cycle. Run `pnpm typecheck` before
> commit. Do not run `convex dev` or `pnpm dev` — ask if types drift.

For extra TDD rigor on contentious behaviors, consult the **beck** agent
(the canonical TDD voice).

See `references/tdd-loop.md` for the full cycle and skip rules.

## Scoping Judgment (what the model must decide)

- **Test granularity.** One behavior per test. If you can't name the
  behavior in one short sentence, the test is too big.
- **When to skip TDD.** Config (`eslint.config.js`, `tailwind.config.ts`),
  generated code (`convex/_generated/*`), UI layout (CSS, component trees),
  pure exploration. Document the skip in the commit message. Everything
  else: test first.
- **When to escalate.** Builder loops on the same test failure 3+ times,
  the oracle contradicts the constraints, or the spec requires behavior
  that violates an invariant (mocking `@/`, sequential DB writes,
  unbounded `while`). Stop and report, don't power through.
- **Parallelism.** Only parallelize when file ownership is disjoint.
  Shared files → serial builders.
- **Refactor depth.** Local only. Improve the code you just wrote.
  Broader refactors are `/refactor`'s job.

## What /implement does NOT do

- Pick tickets (caller's job, or `/deliver` / `/flywheel`)
- Shape or re-shape specs (→ `/shape`)
- Code review (→ `/code-review`)
- QA against the running app (→ `/qa`)
- Run CI gates beyond the pre-exit check (→ `/ci`)
- Broader simplification passes (→ `/refactor`)
- Ship, merge, deploy (→ human, or `/settle`)

## Stopping Conditions

Stop with a loud report if:

- Packet is incomplete or ambiguous.
- Oracle is unverifiable (prose-only checkboxes with no executable form —
  translate if obvious, otherwise stop).
- Builder fails the same test 3+ times after targeted fixes.
- Spec contradicts itself or violates a stated invariant.
- Tests require `convex/_generated/api.d.ts` regeneration — ask the user
  to run `pnpm dev:convex`, pause until confirmed.
- Playwright E2E requires `GUEST_TOKEN_SECRET`, `CLERK_SECRET_KEY`,
  `NEXT_PUBLIC_CANARY_*`, or Convex dev deployment parity that isn't
  currently available.

**Not** stopping conditions: spec is hard, unfamiliar codebase, initial
tests red, Vitest maxWorkers=1 feels slow. Those are the job.

## Gotchas

- **Reshaping inside /implement.** If the spec is wrong, stop. Don't
  silently rewrite the oracle to match what you built.
- **Declaring victory with partial oracle.** "Most tests pass" is not
  green. Every oracle command exits 0, or you're not done.
- **Flipping the Vitest pool.** If your new test hangs, isolate with
  `pnpm vitest run <file>`, binary-search, check `while` loops for
  termination guards. Do not change `pool: 'threads'` or
  `maxWorkers: 1` — those are pinned to dodge a Node 22 teardown race.
- **Re-shimming localStorage.** `tests/setup.ts` already installs an
  in-memory `localStorage`/`sessionStorage` for Node. If a test tries to
  re-define these globals, it fights the shim. Use the existing globals;
  reach for `vi.spyOn` only for boundary behavior assertions.
- **Mocking `@/` or `../../`.** Red flag. You're mocking an internal
  collaborator. Use the real implementation. If that's impractical, the
  module under test is too big — raise a blocker, don't work around it.
- **Forgetting pen name vs displayName.** Lines carry `authorDisplayName`
  captured at write-time (pen name support). Tests that assert author on
  a line read from the line, not the user record.
- **Spawning `convex dev`.** Don't. Ask the user. Duplicate dev servers
  kill schema sync.
- **Silent catch-and-return.** New code that swallows exceptions and
  returns a fallback is hiding bugs. Fail loud, test the failure mode.
- **Testing implementation, not behavior.** `expect(spy).toHaveBeenCalled()`
  on internal collaborators is the anti-pattern. Test what the module
  does from the outside — the route response, the returned value, the
  rendered DOM.
- **Committing debug noise.** `console.log`, commented-out code, stray
  `.only` on `it.only`/`test.only` (CI forbids it; Playwright's
  `forbidOnly` will fail). Clean before exit.
- **Skipping TDD without documenting.** Config/generated/UI-layout are
  fine skips; silently skipping because "it was simpler" is not.
- **Parallelizing coupled builders.** Two builders editing files that
  import each other = merge pain. Partition by file ownership first.
- **Branch drift.** Forgetting `git checkout -b <type>/<slug>` before
  the first commit. Always branch first; base branch is `master`.
- **Scope creep.** Builder adds "while I'm here" improvements. Raise a
  blocker, don't silently expand the diff. Fix-everything-on-encounter
  applies to _gates and broken things you touched_ (per user mandate) —
  not to unrelated refactors.
- **Trusting self-reported success.** Builders say "all tests pass." Run
  the oracle yourself. Run `pnpm ci:prepush`. Agents lie (accidentally).
