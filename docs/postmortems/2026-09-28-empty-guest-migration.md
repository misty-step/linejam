# Postmortem: an unplayed guest session treated as a failed migration

- **Incident date:** 2026-09-28.
- **Status:** Reproduced on production; structural repair and release evidence tracked on MIS-185.
- **Operational owner:** Linejam engineering, commissioned by Phaedrus through Kaylee.
- **Tracker:** [MIS-185](https://linear.app/misty-step/issue/MIS-185)

## Summary

Signing in from a fresh anonymous browsing session reached an error instead of
completing the callback. The session had a valid guest token but no guest game-user
record: browsing creates the token, while hosting or joining creates the record.
The migration incorrectly required an existing record even when there was nothing
to transfer. The repair makes this authenticated, verified empty history a
successful, write-free outcome at the migration boundary.

This differs from [MIS-184](2026-09-28-convex-auth-handshake.md), which repaired a
stale Convex authentication verdict. Reverting that repair would restore the auth
race without removing this preexisting migration error.

## Impact

The alerted event at 17:38:55 UTC on `a9ad8ca23c4e7db59f07b6ccfa43ce12bfa6606a`
came from commissioned MIS-184 acceptance using the existing smoke account.
The callback displayed its recovery screen; **Go home** returned to the signed-in
home and protected profile. That session had no guest game-user record to migrate.
The failing branch executes before any database write, so this failure cannot
partially transfer or delete games, poems, favorites, or the guest record. No
manual player-data repair is indicated or performed.

At 17:56:50 UTC, Sentry contained two matching events, at 17:38:55 and 17:41:38,
both on that production release. No later event or earlier-release match appeared
in the retained operation-tagged search. The second timestamp overlaps the prior
QA window, but the retained sanitized evidence cannot independently identify its
session. Event counts are not affected-player counts; redacted telemetry cannot
establish whether another player also encountered this state.

The affected condition is specific: a signed-in, Convex-authenticated callback,
a valid guest token, no matching guest-user record, and no previous migration
receipt for that account. Callbacks without a token, anonymous gameplay, and
migration with an existing guest record do not take this failing branch. The
existing transfer, ownership, conflict, and retry tests passed before the fix;
the new empty-history regression failed. Production verification after release
must additionally establish real browser completion and populated-history
continuity, not infer them from those tests.

## Timeline

| Time (UTC)          | Observation                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-19          | Commit `7cbe89a` introduced the missing-guest rejection in PR #119.                                                                                                                               |
| 2026-04-02          | Commit `a224daf` added callback recovery instead of unconditional navigation in PR #200.                                                                                                          |
| 2026-09-28 17:36    | MIS-184 release `a9ad8ca` became active; its diff does not change the migration or callback implementation.                                                                                       |
| 2026-09-28 17:38:55 | Commissioned callback verification produced the alerted migration error.                                                                                                                          |
| 2026-09-28 17:39    | Alert intake received the event and opened MIS-185.                                                                                                                                               |
| 2026-09-28 17:56:50 | Read-only Sentry investigation found two matching retained events, with the last at 17:41:38.                                                                                                     |
| 2026-09-28 17:58    | The replacement regression failed with `Guest user not found`; the other 19 migration-file tests passed. A fresh production browser reproduced callback recovery, then recovered through Go home. |

The new 17:58 reproduction is additional commissioned QA, not evidence of an
increase in independently identified affected players. MIS-185 records the exact
candidate, merged/deployed revision, final checks, and post-release observation
window.

## Evidence and mechanism

`lib/auth.ts` bootstraps an anonymous session. The guest-session endpoint signs an
identifier and sets its cookie without inserting a Convex user. `ensureUserHelper`
creates that user lazily when a guest hosts or joins. Therefore possession of a
valid guest token does not imply that a game-user record exists.

`migrateGuestToUser` authenticates the Clerk caller, verifies the guest token, and
looks up the guest user and prior migration. Its missing-user exception preceded
`ensureUserHelper`, all ownership changes, deletion, and migration recording.
`AuthCallbackPage` correctly keeps real errors recoverable and only clears the
guest session after a resolved migration; the mistaken exception made an empty
session look like a failed transfer.

PR #533 repaired the provider's pending-auth transition. It did not modify these
paths. Correct authentication can now reach the existing backend error rather
than fail at the earlier auth fence. The production release on an event identifies
where it surfaced, not where this defect originated.

Evidence owners:

- [Sentry issue 7759687210](https://misty-step.sentry.io/issues/7759687210/).
- [Migration boundary](../../convex/migrations.ts).
- [Callback consumer](<../../app/(auth)/callback/AuthCallbackPage.tsx>).
- [Real database regression](../../tests/convex/migrations.test.ts).
- [MIS-184 production receipt](https://github.com/misty-step/linejam/pull/533#issuecomment-5875499810).

## Pokayoke

How can we pokayoke this so this kind of error never happens again?

**Class:** a valid anonymous session with no persisted gameplay is classified as
failed account migration solely because its lazily created guest record is absent.

**Mechanism:** the migration owner models authenticated, token-verified absence as
successful zero work, before any write. It returns the existing success receipt
with zero transfer counts. It does not create an account, placeholder guest, or
migration marker. The callback uses its normal success path; it does not catch and
hide errors, skip authentication, or guess whether there is data to transfer.

The real `convex-test` regression replaces the test that pinned the erroneous
exception. It proves the zero-transfer result, unchanged users, and no migration
marker, then creates a real guest room and transfers it to the same account.
That continuation protects against a subtler failure: an empty attempt recording
an account-wide marker and silently preventing a later genuine transfer. Existing
unauthenticated, invalid-token, same-room identity-conflict, native/legacy history,
reader assignment, and idempotence contracts remain in force. These boundaries
support US-001's optional account entry, US-002's seat continuity, and US-003's
private ownership.

Residual failures remain explicit: invalid or expired guest proof, actual provider
rejection, conflicting room identities, and transport failure. No exception is
suppressed and no player data is repaired by hand. This change does not redesign
the existing account-wide migration receipt or claim to repair unrelated ownership
problems.

## Follow-up

- Linejam engineering owns normal review/release and production acceptance on
  MIS-185: fresh unplayed guest sign-in, callback cleanup, real guest-room transfer,
  seat/host continuity after reload, and owned session/room cleanup. The ticket
  carries the final revision-specific receipt and class-closing change link.
- MIS-184 remains a separate resolved auth-verdict incident with its own
  postmortem and regression. Neither repair changes provider keys or the
  MIS-174/MIS-183 workflow lane.
