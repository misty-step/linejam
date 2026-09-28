# Postmortem: Optional note-provider failure blocked release preparation

- **Incident date:** 2026-09-28
- **Status:** Mitigated; structural correction under verification and review. Not closed.
- **Operational owner:** Linejam release administration; Kaylee coordinates MIS-183.
- **Tracker:** [MIS-183](https://linear.app/misty-step/issue/MIS-183/github-release-preparation-blocked-by-openrouter-403)
- **Story:** US-004, Release administration.

## Summary

Linejam required successful optional public-note synthesis before it would prepare
any release candidate. The repository's OpenRouter secret referenced a shared
utility key whose weekly allowance was already exhausted by another consumer.
Landmark's model chain used that same credential for every attempt, so model
fallback could not restore access. A provider HTTP 403 therefore prevented a
reviewable technical release candidate, even though deterministic release history
was available.

This was a release-administration incident. The alert intake's hardcoded
“Production failure” title incorrectly implied player-facing impact.

## Impact

- [Release attempt 1](https://github.com/misty-step/linejam/actions/runs/36445103936/attempts/1)
  failed during preparation at source
  `f6f61c389603aad3f9b85b603c97ce3600aeed0a`. It did not refresh the existing
  [release PR #521](https://github.com/misty-step/linejam/pull/521) or dispatch its
  full CI gate. It did not publish a tag or GitHub Release.
- Before remediation, PR #521 still held the previous candidate for source
  `672b898`; the latest published GitHub Release remained `v0.27.0`.
- The player application deployed independently: DigitalOcean deployment
  `1ddae39c-bfbc-44ad-821c-99065f4d3c02` became ACTIVE at 15:43:46Z. Read-only health
  checks subsequently served `f6f61c3`, healthy, with Convex connected and
  environment parity true. Release failure did not block that deployment.
- MIS-174's merge-triggered deployment authority mistake and its separate Sentry
  bookkeeping HTTP 401 are different incidents. A healthy deployed application
  does not resolve either authority or observability issue.

## Timeline

All times are UTC on 2026-09-28.

| Time          | Observation                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15:29:06      | Master push `f6f61c3` independently started the DigitalOcean deployment.                                                                                                                                                      |
| 15:39:24      | Landmark logged a model request failure, HTTP 403.                                                                                                                                                                            |
| 15:39:26      | Release preparation failed; candidate update and CI dispatch were skipped.                                                                                                                                                    |
| 15:43:46      | DigitalOcean reported the player deployment ACTIVE.                                                                                                                                                                           |
| 15:44:54      | Health readback served `f6f61c3`, healthy.                                                                                                                                                                                    |
| 16:00:30      | A later health readback again served the healthy `f6f61c3` deployment.                                                                                                                                                        |
| Investigation | A read-only CI probe proved the repository secret matched the exhausted shared utility key. Analytics bounded through 15:39:24 showed its allowance had already been exceeded before the failure.                             |
| Decision      | Phaedrus approved explicit technical-only candidates on provider failure, preserving integrity, review, CI, and publication gates. Separately, Phaedrus authorized the OpenRouter owner to provision a dedicated release key. |
| 17:06:03      | Only Linejam's repository `OPENROUTER_API_KEY` secret was rebound to the owner-provisioned dedicated key.                                                                                                                     |
| 17:08:31      | [Release attempt 2](https://github.com/misty-step/linejam/actions/runs/36445103936/attempts/2) succeeded against unchanged master `f6f61c3`.                                                                                  |
| 17:08:36      | PR #521 was refreshed at `200fdc6ba29965c113bda393f802c3a53915e75e`, with a valid `0.28.0` candidate sourced from `f6f61c3`; its full CI gate was dispatched.                                                                 |

## Evidence and mechanism

The workflow used a repository-level `OPENROUTER_API_KEY`, which overrides the
organization secret of the same name. The actual issuer identity was
`misty-step/shared/workstation/utility`, enabled, without expiry, with a USD 12
weekly cap and zero remaining allowance. A
[read-only CI diagnostic](https://github.com/misty-step/linejam/actions/runs/36451540606)
compared the held credential in memory and emitted only a match boolean and
allowlisted metadata. Its temporary branch was removed.

Issuer analytics filtered to that exact key, ending at the logged failure time,
reported USD 12.000726 for Harness Semantic Diff Review. This proves exhaustion
preceded the Release failure; it is not a later balance snapshot. Historical
consumers also included Claude Code and unattributed calls. Aggregate analytics
and key-meter totals use different accounting views and are not interchangeable.
No evidence attributes unattributed calls to a particular application.

Landmark retained the HTTP status, not the provider denial body. Exhaustion was a
proven blocking condition; the record does not invent the missing response text.
A display-name change does not explain the demonstrated budget exhaustion.

The integration owner replaced only Linejam's repository secret. The issuer owner
provided `misty-step/linejam/ci/release-notes`, enabled, USD 5 per UTC calendar
month, with a per-key allowlist for the pinned Landmark balanced model chain.
The provisioning owner reported a successful allowed-model inference and a
blocked disallowed-model request. No key value appears in the evidence or
repository. The project `.env.pass` owns the names-only credential reference.

The real online consumer then passed: attempt 2 prepared valid current-source
notes, refreshed the review PR, and dispatched
[CI run 36456022124](https://github.com/misty-step/linejam/actions/runs/36456022124).
That full CI run and its merge gate passed. This proves credential integration,
preparation, and candidate CI, not review approval, publication, or deployment
approval.

The new provider-failure path has a failing-before/passing-after regression in
`tests/scripts/release-prepare.test.ts`: the original preparation code rejected
the controlled 403, while the corrected code prepared a technical-only
candidate. At workspace snapshot `dd1d8969167f09ae84588e762c38cbf87ddb8824`,
a bounded smoke used the pinned Landmark v0.28.8 binary
(`ee0b84f88302ddeb93d2cef7a350192479ad0121`) against a local HTTP 403
server. Five requests exercised the balanced model chain; no external
requests occurred. The resulting `unavailable` candidate removed stale notes,
kept source-bound technical history, and passed the publication adapter's
source and body checks. The controlled local provider and fixture are not
evidence of a hosted technical-only publication.

## Pokayoke

US-004 requires optional provider availability to be separate from release
integrity. The structural correction introduces an explicit `unavailable` note
state rather than swallowing every synthesis error or pretending a policy skip.
Only current, strictly validated native provider-request failure evidence can
produce a technical-only candidate. Malformed release evidence, missing required
configuration, and invalid or ungrounded output remain hard failures.

A technical-only candidate removes stale same-version public notes, retains
current deterministic technical history, and carries the explicit status through
the catalog, application, site, feed, PR, and publication adapter. Review, exact
source validation, full CI, and publication checks remain mandatory. No public
text is fabricated and no fallback silently reuses earlier generated notes.

The dedicated credential also removes the observed shared-consumer budget
coupling. Isolation alone is not error-proofing: this key can still exhaust its
own cap, a provider can fail, and a model policy can reject a request. The explicit
candidate state closes the supported provider-request failure path without
relaxing content integrity. Unknown CLI/protocol failures still fail closed.

The separate hermes-config owner implemented generic source/environment-aware
alert classification in [draft PR #104](https://github.com/misty-step/hermes-config/pull/104),
commit `73dddf27f80507b5f21730f90dd4ee3d57713ff9`, based directly on master
`7767532`. It preserves routing, closure, and marker/fence defenses.
The owner's evidence is 37 passing intake-ticket tests, a clean System One
review, and a real `ticket_text` smoke: CI workflow events produce “CI workflow
failure” and “CI workflow administration alert”; production deployment events
produce “Production deployment failure.” Hosted `ci`, `python-suites`, and
`convex-kit` passed at that commit. The draft is held; CodeRabbit skipped draft
review. It is not merged or deployed and is not claimed as live alert behavior.

The Linejam correction is in [draft PR #535](https://github.com/misty-step/linejam/pull/535)
at commit `57ceaf9aa23226a0774c3115e731e93b157b8086`.
[Hosted CI run 36466073857](https://github.com/misty-step/linejam/actions/runs/36466073857)
passed its merge gate. Its [sanitized story-walk receipt](https://github.com/misty-step/linejam/actions/runs/36466073857/artifacts/10989678877)
records US-004 criteria 1–6 passing at tree
`c754682c33c39387871a4e530f94b8c3a94bfde8`: controlled provider
failure, stale-note removal, invalid-evidence rejection, candidate gate,
rendered public surfaces, and correct release-only incident wording. This is
isolated CI acceptance, not a hosted technical-only publication.

## Follow-up

The failing-before/passing-after regression, pinned-native smoke, and US-004
hosted story walk are complete. The incident remains In Progress pending
review, explicit authorization for the Linejam correction's merge/deployment,
and the separately authorized hermes-config alert-classifier rollout. That
classifier patch is independently cherry-pickable; it does not depend on
hermes-config's separate root-consolidation PR #105.

Merging Linejam master triggers a player deployment. Credential integration and
release verification do not authorize that merge or deployment, nor do they
authorize merging the generated release PR.
