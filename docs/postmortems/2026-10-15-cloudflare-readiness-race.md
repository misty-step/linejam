# Postmortem: Deploy readiness check raced Cloudflare propagation

- **Incident date:** 2026-10-15 (earlier instances on 2026-10-13)
- **Status:** Closed by [PR #563](https://github.com/misty-step/linejam/pull/563):
  a structural fix with its regression check.
- **Operational owner:** Linejam production deployment (the Cloudflare
  Production workflow).
- **Tracker:** [PR #563](https://github.com/misty-step/linejam/pull/563).

## Summary

The Cloudflare Production workflow checked readiness with a single
`/api/health` request, made immediately after `wrangler deploy`. A new Worker
version takes seconds to reach every Cloudflare edge, so that request could
reach an edge still serving the previous source. The check then failed a good
deploy.

The class of error: a post-deploy check that treats "not yet propagated" as
"failed", and a failure message that does not say what production served.

## Impact

- **Observed:** 3 of the 11 Cloudflare Production runs failed on their first
  attempt at "Verify served source and backend readiness":
  - `f701331` on 2026-10-13 at 00:21Z
  - `d235c54` on 2026-10-13 at 01:46Z
  - `763eeda` (v0.28.1) on 2026-10-15 at 01:42Z

  In each run the preceding deploy step had succeeded.

- **Observed:** for `763eeda`, the following independent readbacks all passed:
  - An `/api/health` read 23 seconds after the failed check: `ok`, version
    0.28.1, deployment `763eeda`, Convex connected and guest-secret parity.
  - [Rerun attempt 2](https://github.com/misty-step/linejam/actions/runs/38667102230):
    the same check passed.
  - A dispatched [Production Smoke](https://github.com/misty-step/linejam/actions/runs/38667659558):
    passed.
- **Observed:** no player impact. Production served healthy code throughout.
  The harm was a false red deploy record, which costs triage and teaches
  people to ignore real deploy failures.
- **Inference:** the two earlier failures had the same cause. Their logs cannot
  confirm this, because the check never printed what it saw.

## Timeline

| Time (UTC)       | Observation                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-13 00:21 | Run for `f701331` fails at the readiness check after a successful deploy.                                                          |
| 2026-10-13 01:46 | Run for `d235c54` fails the same way.                                                                                              |
| 2026-10-15 01:42 | [Run 38667102230](https://github.com/misty-step/linejam/actions/runs/38667102230) starts for the v0.28.1 release commit `763eeda`. |
| 01:44:49         | The single readiness request fails with "Production readiness failed" and no observed values.                                      |
| 01:45:12         | An independent `/api/health` read shows `ok`, 0.28.1, deployment `763eeda`, Convex connected and guest-secret parity.              |
| 01:48:49         | The failed job is rerun and Production Smoke is dispatched.                                                                        |
| 01:50:56         | The rerun verifies source, Convex connection and guest-secret parity.                                                              |

## Evidence and mechanism

The step made one request and compared five fields: HTTP status, `status`,
`deployment.id`, `convex` and `guestTokenParity`. Any mismatch threw the same
message, with no observed values.

Right after a deploy, an edge can still serve the previous Worker version.
Its `deployment.id` is the previous commit, so the comparison failed even
though the new version was healthy and arrived seconds later.

The rerun is consistent with this mechanism. Rerunning the job redeploys the
same commit, so the old and the new Worker versions both report the expected
`deployment.id`, and the check passes however far propagation has got.

## Pokayoke

[`scripts/ci/verify-production.mjs`](../../scripts/ci/verify-production.mjs)
makes "not yet propagated" an explicit wait state, not a failure:

- It polls `/api/health` up to 24 times, 5 seconds apart.
- It passes only when the exact deployed SHA is served with status `ok`,
  Convex connected and guest-secret parity.
- Every other final state fails closed. The failure reports the last observed
  HTTP status, status, deployment, Convex state and parity, or the request
  error.

[`tests/ci/verify-production.test.ts`](../../tests/ci/verify-production.test.ts)
pins this behaviour. It covers these cases:

- waiting through edges that still serve the previous source
- failing with what was served when the source never arrives
- requiring full readiness on the new source
- rejecting a non-200 response that has a ready body
- retrying network errors and non-JSON pages

What still fails is an edge serving the previous source for longer than the
bounded wait. That is correct: it is a real propagation fault, and the message
now says what was served.

## Follow-up

None owned. [PR #563](https://github.com/misty-step/linejam/pull/563) closes
this class. It adds the script, its regression test
([`tests/ci/verify-production.test.ts`](../../tests/ci/verify-production.test.ts))
and the workflow step.
