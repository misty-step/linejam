# Decouple browser proof from UI copy: testid contract + early smoke gate

Priority: P1 · Status: ready · Estimate: M

## Goal

A UI copy/structure rename can no longer ship green through pre-push + the full
unit suite while silently breaking the hosted E2E and the hourly production
smoke.

## Oracle

- [ ] The ~10 load-bearing E2E touchpoints (start/submit/seal controls, reveal
      controls, word-slots, phase headings) are targeted via a frozen
      `data-testid` (or deliberately-frozen aria) contract in
      `tests/e2e/support/guestFlow.ts` and `tests/e2e/prod-smoke.spec.ts` — not
      display strings.
- [ ] A fast headless smoke (host create → start → submit round 1 → reveal
      heading, ~60s) runs in pre-push or an independent non-draft-gated CI job,
      surfacing structural breaks before the ~25-min hosted E2E and the hourly
      prod canary.
- [ ] A lint/unit check fails if a contract `data-testid` is removed from source.

## Verification System

- Claim: structural/copy UI changes are caught by a fast pre-merge check, not
  only the slow hosted E2E or the prod canary.
- Falsifier: rename a button's copy → unit suite + pre-push stay green but the
  change is unguarded until the hosted E2E (or prod).
- Driver: rename a control's text in a branch and run the smoke.
- Grader: the smoke fails on the rename; after retargeting to the testid, passes.
- Evidence packet: the smoke output on a deliberate rename.
- Cadence: every push (smoke), every merge (full E2E).

## Notes

This bit the team live on 2026-06-24 (PR #278): the writing-chrome change
("Round N of 9" → "Round N · M words", Seal → Submit, controls into an overflow
menu) passed pre-push + 1019 unit tests but failed E2E Mirror / QA Evidence on
`getByText('Round 1 of 9')`; the same coupling also breaks
`tests/e2e/prod-smoke.spec.ts`. Only 3 `data-testid` exist in the whole tree;
pre-push is Docker-free (no E2E); the hosted `e2e` job is gated `if draft==false`.
Smoke infra already exists (`playwright.smoke.config.ts`, `test:e2e:smoke`) but
isn't wired pre-merge. See [[project_e2e_selectors_coupled_to_ui_copy]].

## Children

1. (M) `data-testid` contract on the load-bearing touchpoints; retarget
   `guestFlow.ts` / `prod-smoke.spec.ts`.
2. (S) Wire `test:e2e:smoke` into pre-push or an early independent CI job.
3. (S) Land the planned mock-boundary ESLint rule (`no-restricted-imports`
   banning `vi.mock('@/…')` outside a boundary allowlist) and de-mock the
   adjacent-green tests (`tests/app/room-page.test.tsx` mocks Lobby /
   WritingScreen / RevealPhase).
4. (S) Add a repo-local `verify`/`qa` SKILL.md encoding the real run routes
   (`pnpm dev`, `evidence:guest-flow`, `qa:agentic:local`, the smoke path) — the
   highest-leverage agent-readiness gap.
