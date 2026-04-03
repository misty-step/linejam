# Establish backlog.d Operating System

Priority: high
Status: done
Estimate: S

## Goal

Replace ad hoc planning with a single file-driven backlog that future agents can claim, prioritize, and execute without guesswork.

## Non-Goals

- Implement any product or infrastructure feature from the backlog itself
- Recreate deleted legacy planning files
- Introduce external issue tracker dependencies

## Oracle

- [x] `backlog.d/README.md` defines ordering, status rules, and claim workflow.
- [x] `scripts/lib/claims.sh` exists and supports `claim_acquire`, `claim_release`, and `claim_list`.
- [x] The active queue exists as numbered files under `backlog.d/`.
- [x] Completed setup work is archived under `backlog.d/_done/`.

## Notes

- The working tree no longer contains `BACKLOG.md`, `TODO.md`, or `TASK.md`; this backlog starts from current repo state plus the 2026-04-01 groom/session-readiness synthesis.
- Priorities are ranked by impact on launch readiness first, then by feasibility and dependency order.

## What Was Built

- Created `backlog.d/README.md` as the backlog contract.
- Added `scripts/lib/claims.sh` for atomic local claims.
- Added the first prioritized backlog slice for room-flow resilience, lifecycle consolidation, release hardening, observability, and sharing.
