---
name: shape
description: |
  Shape a linejam idea into a buildable context packet — a `backlog.d/NNN-*.md`
  that /implement can take to green tests without re-derivation. Problem statement,
  interface sketch, data model impact, Vitest + Playwright tests to write, oracle
  commands, invariant compliance, ADR (if architectural).
  Use when: "shape this", "write a spec", "spec out", "context packet",
  "design this feature", "plan this", "add to backlog".
  Trigger: /shape, /spec, /plan, /cp.
argument-hint: '[idea|backlog-item|observation] [--spec-only] [--design-only]'
---

# /shape (linejam)

Turn an idea into a **buildable context packet**. The output is a numbered file in
`backlog.d/` that a builder agent can take to green tests without asking follow-up
questions about intent. The repo-brief at `.spellbook/repo-brief.md` is the shared spine —
cite its anchors verbatim, do not invent parallel vocabulary.

## The Contract

A shape is done when:

1. A file exists at `backlog.d/NNN-kebab-title.md` with the required fields below.
2. Every oracle entry is an **executable command** or a **verifiable observable**, not prose.
3. Every invariant in `.spellbook/repo-brief.md` §Invariants is either upheld or has an explicit call-out + justification.
4. If the shape affects architecture (auth flow, `convex/schema.ts`, theme tokens, game state machine, assignment matrix, AI persona contract), a draft ADR exists at `docs/adr/NNNN-kebab.md` using `docs/adr/000-template.md`.
5. If `project.md` is out of sync with the shaped surface, it's updated in the same operation.
6. Backlog numbering: find the highest number in `backlog.d/` (including `_done/`), add one. Zero-pad to 3 digits.

## Required Fields (the backlog.d file)

Match the exemplar exactly. See `backlog.d/_done/001-harden-guest-first-room-flow.md`
and `backlog.d/_done/002-extract-session-transition-core.md` for the canonical shape.

```markdown
# Title Case Goal

Priority: high | medium | low
Status: ready | blocked | in-progress
Estimate: S | M | L | XL

## Goal

One sentence. Outcome, not mechanism. What changes for the player, the builder, or
the gate — not which files you will edit.

## Non-Goals

- What this will NOT address, even if adjacent
- Scope boundaries that would otherwise drift

## Oracle

- [ ] `pnpm vitest run tests/<area>/<file>.test.ts` — new + existing tests pass
- [ ] `pnpm ci:dagger:<lane>` — relevant Dagger lane green
- [ ] Observable outcome — stated as a check anyone can run or see
- [ ] No new silent `catch {}` paths introduced (when touching error paths)

## Notes

- Primary evidence: concrete file paths that ground the problem
- Load-bearing constraints from the repo-brief (invariants #N violated / upheld)
- Why this scope and not wider

## Implementation Sequence

1. Add failing test for <behavior>
2. Make it green with <minimal change>
3. Refactor / extend as needed
4. Update observability / telemetry / ADR

## Repo Anchors

- `path/to/file.ts` — pattern to follow
- `path/to/adjacent.ts` — similar surface already shipped
```

The "What Was Built" / "Verification" / "Workarounds" sections get filled by
`/implement`, not by `/shape`. Do not pre-fill them.

## Workflow

### Phase 1: Understand (before touching anything)

Read, in order:

1. `.spellbook/repo-brief.md` — vocabulary, invariants, known debts, gotchas.
2. The raw request. Quote it back if the user pasted source material; capture verbatim.
3. `backlog.d/README.md` + recent numbered files. Check for adjacency, duplication, split candidates.
4. The code surface. Bounded read (≤5 files) once the target is known. If you find yourself reading >5 files, the scope is too big — see **When to escalate to /groom**.

If the request is a backlog.d/ item in `Status: ready`, you are **re-shaping**, not
creating — validate that Oracle is still executable and nothing in the repo drifted.

### Phase 2: Challenge the Premise

Five-whys the stated goal. If the request says "add X," name the underlying outcome
first — the best path to it may not be X. A solid shape of the wrong problem is the
failure mode this skill exists to prevent.

Session signal: user explicitly says **"what are all the different shapes?"** when
they sense a single recommendation dressed as the answer. Default to ≥2 structurally
distinct options. One minimal-viable, one ideal, optionally one that inverts a
load-bearing assumption. If you can't articulate how each would fail _differently_,
you have one option wearing costumes.

For non-trivial architectural decisions, fan out to ≥4 voices before converging
(see `~/.claude/projects/-Users-phaedrus-Development-linejam/memory/feedback_divergence_for_design_decisions.md`):
Thinktank + Gemini + Codex + fresh-context subagent. Same-model self-critique is
theater.

### Phase 3: Shape the Context Packet

Fill every field. No placeholders. The builder does not get to ask follow-ups;
unclear spec means you go back to Phase 2.

**Problem statement (Goal + Notes):** One paragraph. What's broken or missing?
What does success mean for the player / builder / gate?

**Non-goals:** Load-bearing. Agents drift toward scope expansion. Write them.

**Interface sketch:** Signatures only. Specify WHAT and WHY. Let the builder
choose HOW.

- React components — props + types (match `components/*` patterns)
- Convex mutations/queries — arg validators, return types. Use `v.` schema validators; cite the `api.*` path in `convex/_generated/api.d.ts`.
- API routes — HTTP method, path, request/response shape (match `app/api/guest/session/route.ts` pattern)
- Hooks — signature + returned shape (match `lib/auth.ts:useUser()` pattern)

**Data model impact:** If `convex/schema.ts` changes, call out the diff and the
migration strategy. Schema changes route to `/convex-migrate`. Index changes that
affect `rooms.by_code` / `poems.by_room` / `lines.by_poem` / `favorites.by_user`
need explicit test coverage.

**Tests to write:** Concrete file paths. Existing Vitest layout: `tests/<area>/<file>.test.ts`.
Existing Playwright layout: `tests/e2e/*.spec.ts`. Name each test by the behavior it
gates, not the function it exercises. Mock only at system boundaries (Convex/react,
@clerk/nextjs, fetch, localStorage, clipboard, Date.now, Math.random) — invariant #5
forbids mocking `@/` or `../../` paths.

**Oracle:** Executable. Commands that exit 0 on success. See `references/executable-oracles.md`.
The default oracle suite for a linejam shape:

```bash
pnpm vitest run tests/<scoped-paths>          # new + existing unit/integration tests pass
pnpm typecheck                                 # no type errors introduced
pnpm lint                                      # clean
pnpm ci:dagger:<lane>                          # relevant Dagger lane green
```

Add observable outcomes for anything that requires visual/interactive verification
(e.g., "Reveal phase renders all nine rounds in order"). Keep oracles binary:
pass/fail, no interpretation.

**Invariant compliance:** Walk the 10 invariants in the repo-brief. For each one the
shape touches, state "upheld via <mechanism>" or "violated because <justification>."
Never silently break one. Common hot spots:

- #5 (no mocking `@/`) — call out the mock boundary explicitly
- #6 (parallel DB writes) — if the mutation touches multiple rows, it's `Promise.all` or `q.or()`
- #7 (while-loop termination guard) — if you added a while-loop, cite the bound
- #8 (`GUEST_TOKEN_SECRET` parity) — if guest-auth changes, parity check is an oracle item

**ADR reference:** Required when the shape affects:

- Auth flow (cite/supersede ADR-0001)
- Game state machine or assignment matrix (cite ADR-0002, ADR-0004)
- Schema topology in `convex/schema.ts`
- Theme tokens or `lib/themes/` contract (cite ADR-0006)
- Parallel write discipline (cite ADR-0007)
- Pen name / write-time capture (cite ADR-0008)

Draft the ADR in the same operation using `docs/adr/000-template.md`. Number it
after the latest (currently 0008). "Proposed" status until the shape lands.

**Repo anchors:** 3–10 files, not 50. If everything is an anchor, nothing is. Pick
the files whose patterns MUST be followed.

### Phase 4: Critique Before Finalizing

For Estimate M or larger, dispatch the bench in parallel before committing. These
are the only subagents that exist in `.claude/agents/`:

- **grug** — complexity demon. Targets over-abstraction, unnecessary layers, speculative generality.
- **ousterhout** — module depth. Targets shallow modules, pass-through layers, interface bloat.
- **carmack** — shippability. Targets scope creep, premature optimization, not focusing.
- **critic** — adversarial review of the shape as written.
- **beck** — test design. Invoke when the oracle is weak or untestable.

For premise audit before shaping: `/ceo-review`. For raw idea intake before shape:
`/office-hours`.

If any persona has a blocking concern, revise. Don't hand-wave past a "this
module is shallow" verdict — it'll come back as rework in /implement.

### Phase 5: Land

- Write `backlog.d/NNN-kebab-title.md`.
- If architectural, write `docs/adr/NNNN-kebab-title.md` (Status: Proposed).
- If `project.md` drifted, update it in the same commit.
- Set `Status: ready` only if every oracle item is concretely authored and every
  invariant is accounted for. Otherwise `Status: blocked` with a pointer to what's missing.

## When to Escalate to /groom

`/shape` is for one coherent delivery unit — one file in `backlog.d/`, one concrete outcome.

Escalate to `/groom` when:

- The surface needs >1 numbered item to land (split candidates).
- The problem framing itself is in question (problem-diamond territory).
- ≥2 structurally distinct shapes are needed and fit-check ambiguity persists after a round of divergence.
- The existing shape surfaces contradictions in `project.md` or across multiple ADRs.

`/groom` is the problem-diamond; `/shape` is the solution-diamond for a single slice.

## Gotchas

- **Premise unchallenged.** Five-whys before you shape. The ticket encodes a symptom, not the root cause.
- **Alternatives-in-name-only.** Three options that are the same idea in three outfits is one option. Real divergence: how would each fail _differently_?
- **Vague oracles.** "It should work" is not an oracle. `pnpm vitest run tests/lib/auth.test.ts` is.
- **Checkbox oracle drift.** Prose checklists decay into opinion. Write commands that return pass/fail.
- **Speccing after building.** A context packet written after implementation is documentation, not specification. Spec first.
- **50 repo anchors.** Pick 3–10 files whose patterns MUST be followed. If everything is an anchor, nothing is.
- **Skipping non-goals.** Agents drift toward scope expansion. Non-goals are load-bearing.
- **Over-speccing implementation.** Specify WHAT and WHY. Let the builder choose HOW. Detailed pseudocode cascades errors.
- **Silent invariant violations.** Every invariant the shape touches gets an explicit call-out. No assumptions the builder will "just know."
- **ADR omission on architectural change.** Schema, auth, state-machine, theme, or assignment-matrix changes without an ADR = silent precedent. Draft it in the same operation.
- **Wrong vocabulary.** Poem not document. Line not entry. Round not step (0–8, nine total). Pen name not nickname. Guest UUID / guest token not anonymous ID. Host not admin. Cycle not session. Room code not game ID. Reveal phase not endgame. Dagger not "the CI." Reject synonyms on sight.
- **Mocking `@/` paths.** Invariant #5. If your test plan mocks internal collaborators, rewrite the test plan.
- **Re-raising prompt injection in OpenRouter.** User deprioritized explicitly. Do not re-raise unless the AI surface expands beyond trusted-user multiplayer poetry.
- **Resurrecting Cerberus.** Deleted in `5dc890c`. Don't cite it, don't propose re-adding it.
- **Backlog file for something that isn't a backlog item.** If it's research, use `/research`. If it's an incident, use Canary. If it's a question, ask the user.
- **Un-ratified convergence.** Divergence proposes, user disposes. Silent absorption of a second opinion is not ratification.

## Principles

- **Minimize touch points** — fewer files = less blast radius. One coherent delivery unit per shape.
- **Design for deletion** — easy to revert, no spreading dependencies into the critical path.
- **Favor existing patterns** — `components/`, `convex/lib/`, `lib/`, `hooks/` each have canonical shapes. Follow them.
- **YAGNI ruthlessly** — if it's not in the goal, it's not in the shape.
- **Recommend, don't just list** — options exist to be compared and chosen, not archived.
- **One question at a time** — iterating with the user is cheaper than producing a wrong packet fast.
- **Fix what you touch** — pre-existing issues in the same area get addressed, not excused. "Not introduced by this shape" is not a valid deferral. Boil the ocean.
