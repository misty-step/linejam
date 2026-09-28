# Postmortem: a previous auth verdict reused during a new sign-in

- **Incident date:** 2026-09-28; earliest retained event 2026-09-10.
- **Status:** Structural fix and regression verified; production rollout evidence is tracked on MIS-184.
- **Operational owner:** Linejam engineering, commissioned by Phaedrus through Kaylee.
- **Tracker:** [MIS-184](https://linear.app/misty-step/issue/MIS-184)

## Summary

A successful Clerk sign-in could briefly look like a completed Convex rejection.
Convex 1.42.3 retained the signed-out `false` verdict while fetching and confirming
the new account token. Linejam correctly fences unverified accounts, but interpreted
that stale verdict as a terminal failure and reported `convexAuthUnavailable`.
The repair resets the provider's verdict to pending synchronously on sign-in;
it does not debounce, downgrade, or remove reports of actual rejection.

## Impact

Observed on production release `f6f61c389603aad3f9b85b603c97ce3600aeed0a`:

- A guest and an existing production smoke account joined the same room,
  submitted round-one lines, and advanced to round two. The owned game was
  ended and room closed through the player UI. No ongoing Clerk-to-Convex outage
  was observed.
- The normal sign-in form reached email verification. The account session used
  the supported sign-in-ticket strategy also used by `@clerk/testing`; this does
  not establish real mailbox delivery. No account, key, or provider configuration
  was created or changed.
- A subsequent in-place sign-in emitted the error before Convex acknowledged
  authentication. The host form then recovered without a refresh.
- Affected consumers include host/join/room gates and the guest-to-account
  callback. The callback can enter recovery on a stale rejection. Stranded
  production migrations were not established by the retained evidence.

As of 2026-09-28 16:47 UTC, Sentry Discover counted 245 production-tagged and
514 test-tagged events over 30 days; the last 24 hours contained 25 production
and 145 test events. The issue detail counter was one lower than Discover's 759. These are event counts, not affected-player counts: privacy filtering
removes identifying data, and `userCount: 0` does not mean zero affected users.
The recent high-volume spike was concentrated in the test environment, but the
production events must not be dismissed as test-only.

## Timeline

| Time (UTC)              | Observation                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-10 17:36        | First retained event in [Sentry issue 7724620039](https://misty-step.sentry.io/issues/7724620039/).                                                                                                       |
| 2026-09-17 17:50        | Sentry automatically changed the issue to ongoing after seven days. Its activity contains no resolution/regression transition.                                                                            |
| 2026-09-28 16:34:16.874 | Alerted event on `f6f61c3`; [production smoke](https://github.com/misty-step/linejam/actions/runs/36451848602) ran 16:34:05–16:34:20 and passed. The overlap is correlation, not proof of event identity. |
| 2026-09-28 16:35        | Kaylee received the production alert and commissioned MIS-184.                                                                                                                                            |
| 2026-09-28 16:44–16:52  | Headless live sign-in, protected profile, Convex token, mixed-identity room entry and accepted gameplay observed.                                                                                         |
| 2026-09-28 16:54:54.717 | In-place sign-in reproduction began on `/host`; error emitted at +477 ms, first Convex `Transition` at +589 ms, another at +697 ms. After two seconds, Create room was enabled and the auth error absent. |
| 2026-09-28 16:56        | Real-provider regression failed before repair: pending authentication incorrectly returned `isLoading: false`.                                                                                            |
| 2026-09-28 16:59        | Frozen patched install and 34 focused auth/callback checks passed, including successful and rejected server verdicts.                                                                                     |

## Evidence and mechanism

`ConvexProviderWithAuth` sets its internal verdict to `false` when the identity
provider is signed out. Its public `isLoading` is true only while that verdict is
`null`. Before repair, identity-provider authentication changing from false to true
started `client.setAuth` without resetting the old verdict. Until the callback,
consumers saw a loaded Clerk account plus Convex `false/false`.

`lib/auth.ts` reports that combination as `convexAuthUnavailable` and fences game
queries. `AuthCallbackPage` independently uses the same provider state to decide
whether account migration can proceed. Mocking only static authenticated/loading/
rejected states missed the transition at their shared owner.

The live reproduction used headless Playwright, the existing production smoke
account, Clerk's supported sign-in ticket, and the rendered `/host` page. It
recorded only relative timings, protocol message types, operation names, and
boolean UI outcomes; tokens, room codes, and poem text are not retained here.
The alert's redacted Sentry event has no auth-state breadcrumbs or usable user
identity, so it cannot prove every historical occurrence had this mechanism.

## Pokayoke

How can we pokayoke this so this kind of error never happens again?

**Class:** a settled signed-out verdict is reused as the result of a new,
unconfirmed sign-in.

**Mechanism:** the provider owns a synchronous transition from signed-out to
pending when identity-provider authentication becomes true. The render that
starts a new handshake cannot expose the old terminal verdict to descendants.
Only that handshake's `setAuth` callback can supply its accepted/rejected result.
This protects both the user/session gate and account migration at their shared
state owner, without remounting the application or discarding route state.

The version-bound [pnpm patch](../../patches/convex@1.42.3.patch) repairs source,
ESM, and CommonJS entrypoints. The frozen lock binds the patch hash; the isolated
image copies patches before installation, and runtime source identity includes
their bytes. The
[real-provider regression](../../tests/lib/convex-auth.test.tsx) starts as a guest,
signs in while the server callback is withheld, and verifies pending state,
no false error, and no retained guest proof. Separate accepted and rejected
verdicts prove that genuine rejection still blocks and reports. It failed on
the unpatched provider and passed after repair. This enforces US-001's optional
account boundary and preserves US-003's private-account authorization boundary.

Residual failures remain possible: actual token rejection, provider/network
outages, and email delivery failures. They are not hidden by this fix and are
not claimed error-proofed. No arbitrary grace period or telemetry suppression
was added.

## Follow-up

- The class-closing change is the [provider patch](../../patches/convex@1.42.3.patch)
  with its [regression](../../tests/lib/convex-auth.test.tsx). Linejam engineering
  owns normal review, deployment, and production revalidation; MIS-184 carries
  the exact merged/deployed revision and final evidence.
- Retain the transition regression when upgrading Convex. Remove the patch only
  when the replacement provider passes it without the patch; an upgrade alone
  is not evidence of repair. The inspected 1.46.0 source still had this transition.
- MIS-174/MIS-183 bookkeeping and release-note work is separate. This repair does
  not change those workflows, any credentials, or provider environment values.
