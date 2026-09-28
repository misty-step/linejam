# Postmortem: Sentry bookkeeping failure was reported as player-smoke failure

- **Incident date:** 2026-09-27 (alert); first rejected marker observed
  2026-09-13.
- **Status:** Mitigated, not closed. The signal split is deployed; credential,
  trigger, and deployment-authority follow-ups remain open.
- **Operational owner:** Linejam production observability; Kaylee coordinates
  the incident.
- **Tracker:**
  [MIS-174](https://linear.app/misty-step/issue/MIS-174/github-production-failure).
- **Story:** US-001 guest entry and US-002 game start, as exercised by
  Production Smoke. This incident concerns the reliability of their health
  signal, not a new player capability.

## Summary

`Production Smoke` previously put browser health, Sentry health-check reporting,
and a Sentry release/deploy write in one job. Its release credential was
rejected with HTTP 401. A successful player browser check therefore appeared as
a failed production workflow; the consecutive-failure counter also treated
aggregate workflow failures as player failures. The independent GitHub alert
intake received the failure, but the signal could not tell Sentry bookkeeping
trouble from an outage. The exact credential revocation or expiry cause has not
been established.

## Impact

- [The original scheduled failure](https://github.com/misty-step/linejam/actions/runs/36333407797)
  generated the MIS-174 production alert. A later commissioned reproduction on
  [run 36333982987](https://github.com/misty-step/linejam/actions/runs/36333982987)
  passed the guest host/join/start and signed-in join browser checks while the
  Sentry marker returned HTTP 401. These checks do not cover a full nine-round
  game.
- The last green run before the first rejected marker was
  [34762570307](https://github.com/misty-step/linejam/actions/runs/34762570307);
  the first observed failed marker was
  [34765479539](https://github.com/misty-step/linejam/actions/runs/34765479539)
  on 2026-09-13, at the same source SHA. No player outage was established by
  those marker failures.
- After the split,
  [scheduled smoke 36444183523](https://github.com/misty-step/linejam/actions/runs/36444183523)
  passed both browser checks in 15.3 seconds against the then-served release
  `672b89860b46e4b4efb7d3a8ced624e3cc2b92c0`, and reported an `ok` Sentry
  check-in.
  [Independent bookkeeping 36444285211](https://github.com/misty-step/linejam/actions/runs/36444285211)
  still failed HTTP 401. Its workflow completion reached Kaylee's intake through
  webhook delivery `3845304682905862144` with HTTP 200 and `status: accepted`;
  this is not proof of complete downstream triage.
- The merge of [PR #531](https://github.com/misty-step/linejam/pull/531)
  unintentionally triggered the configured DigitalOcean automatic deployment,
  `1ddae39c-bfbc-44ad-821c-99065f4d3c02`. Read-only health at 15:44:54Z served
  the new `f6f61c389603aad3f9b85b603c97ce3600aeed0a`, healthy with Convex
  connected and guest-token parity true. The scheduled smoke above tested the
  earlier served release; there was no post-deploy browser walk of `f6f61c3`.
  This is a separate authority error, not evidence that the player smoke failed.

## Timeline

| UTC                    | Observation                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-13 15:25       | First observed Sentry marker HTTP 401 after a green run on the same source.                                                                                                          |
| 2026-09-27 16:31       | Scheduled Production Smoke failure reported to Kaylee; MIS-174 opened.                                                                                                               |
| 2026-09-28 15:29       | PR #531 merged at `f6f61c3`; automatic DigitalOcean player deployment began without reconciled deploy authority.                                                                     |
| 2026-09-28 15:32       | Scheduled smoke's player checks passed; independent bookkeeping failed HTTP 401 and GitHub completion reached Kaylee intake.                                                         |
| 2026-09-28 15:43–16:00 | DigitalOcean became ACTIVE; subsequent read-only health served healthy `f6f61c3`. No newer browser acceptance was claimed.                                                           |
| Later review           | The standalone bookkeeping `workflow_dispatch` production-write path was identified as unnecessary. A local workflow/test/runbook correction removes it; deployment remains pending. |

## Evidence and mechanism

The old smoke job contained `record-sentry-deploy.mjs` after its browser check.
That script's first request reads the target Sentry release with
`SENTRY_RELEASE_TOKEN`; a non-2xx response fails the job without emitting the
provider body or bearer. The GitHub repository secret was last updated
2026-08-17 and the deployed workflow returned HTTP 401. GitHub write-only
secrets cannot be read back; do not infer the held token's exact identity or
expiry from the timestamp. The existing workstation `SENTRY_AUTH_TOKEN` returned
HTTP 200 on the canonical organization, prior served release, and deploy-list
**read** endpoints on 2026-09-28. This establishes a usable read credential, not
equivalence with the GitHub secret or permission to write deploys.

The old counter consumed aggregate workflow conclusions. A marker or reporting
failure could increment the player-failure streak even when the browser step
passed. The
[PR #531 regression suite](https://github.com/misty-step/linejam/pull/531)
reproduced this ownership error on the pre-fix source, then exercised
browser-step outcomes, legacy mixed-result runs, reruns, and absent history. A
synthetic HTTP 401 also proved the marker still fails loudly and sanitizes its
diagnostic.
[Hosted CI](https://github.com/misty-step/linejam/actions/runs/36442635042)
passed before merge. The split's real scheduled smoke and separately red
bookkeeping run are the owner-boundary proof; an accepted webhook delivery is
narrower than verified triage or recovery of Sentry writes.

## Pokayoke

[PR #531](https://github.com/misty-step/linejam/pull/531) removes Sentry writes
from the `smoke` player-health job. A separate master-only reporting job owns
monitor check-ins; a separate, hard-failing `Sentry Production Bookkeeping`
workflow owns release/deploy recording. The failure-streak counter reads
browser-step outcomes, including old mixed-result runs, rather than aggregate
job/workflow conclusions; missing or ambiguous evidence fails toward escalation.
The parsed-workflow and counter regressions reject a Sentry writer in the player
job and reject bookkeeping failures counted as failed browser checks. A rejected
Sentry release credential can no longer turn a passing **player job** red or
masquerade as a consecutive browser failure. The aggregate Production Smoke
workflow can still show reporting failure; operators must use the named player
job as the health signal.

The later trigger correction removes `workflow_dispatch` and its alternative
admission path: only completion of the protected master Production Smoke can
launch bookkeeping. The parsed-YAML test failed before this correction on the
extra trigger and passed afterward. Until that correction is merged, the manual
production-write affordance remains available; this portion is not yet
error-proofed in production.

The authority near-miss is a different class. Master merges automatically deploy
through the existing DigitalOcean configuration. A fail-closed merge/deploy
authorization preflight is needed before a future merge, but neither this signal
split nor an instruction in this report enforces it. No deployment policy is
changed by the trigger correction.

## Follow-up

The merged signal-ownership change is
[PR #531](https://github.com/misty-step/linejam/pull/531). Its permanent
contract checks are
[`production-observability-workflows.test.ts`](../../tests/scripts/production-observability-workflows.test.ts)
and
[`count-consecutive-prod-smoke-failures.test.ts`](../../tests/scripts/count-consecutive-prod-smoke-failures.test.ts).

1. **Linejam observability owner:** review and merge the scoped trigger
   correction only with explicit authority for the consequent automatic player
   deployment. Retain its parsed-workflow regression and verify the deployed
   trigger has no standalone dispatch. Do not manually trigger Production Smoke
   or bookkeeping merely to create a receipt.
2. **Phaedrus, token decision:** Sentry's native Internal Integration token with
   minimal `project:releases` scope has organization-wide release authority,
   including other projects and release administration/deletion; it cannot
   enforce a Linejam-project-only boundary. The existing `SENTRY_AUTH_TOKEN` is
   not a safe substitute for that decision. If org-wide release authority is
   acceptable, separately authorize one dedicated token, a names-only pass
   reference, replacing only Linejam's `SENTRY_RELEASE_TOKEN` secret, and
   read-only/normal-run verification. Otherwise keep the marker red and decide
   an architecture that actually enforces project isolation. No token was
   created or rotated in this work.
3. **Deployment owner:** decide a fail-closed merge/deploy authorization
   preflight for auto-deploy branches. This remedy requires an explicit policy
   decision; the unauthorized PR #531 deployment is acknowledged, not
   retroactively authorized.
4. **Kaylee / incident owner:** after authorized token restoration and the
   normal bookkeeping run, verify Sentry's real deploy record and the complete
   independent alert route. Close MIS-174 only when the fix, the regressions,
   and these remaining operational postconditions are linked. The
   [execution record](https://linear.app/misty-step/issue/MIS-174/github-production-failure#comment-c8583aa3)
   retains the source run IDs and narrower evidence.

The source-aware alert-title correction is owned separately by
[hermes-config draft PR #104](https://github.com/misty-step/hermes-config/pull/104).
It has not been merged or deployed; this report does not claim that a Kaylee
ticket already distinguishes CI bookkeeping from a player outage.
