# Postmortem: /releases failed on the Worker, and Sentry filed it under an old issue

- **Incident date:** 2026-10-12 to 2026-10-14.
- **Status:** Open.
  - The detection class is closed by
    [PR #567](https://github.com/misty-step/linejam/pull/567), with its
    regression checks.
  - The runtime class is closed for the release routes by
    [PR #559](https://github.com/misty-step/linejam/pull/559). It stays open
    for every other route, with an owned follow-up.
- **Operational owner:** Linejam production observability.
- **Tracker:** Powder
  `prod-triage-7793706693634e4ccbbe57d39f4fd545af2657ac77956eda9ea4195b924c9134`;
  Sentry [LINEJAM-19](https://misty-step.sentry.io/issues/7723831532/).

## Summary

After the Cloudflare cutover
([PR #549](https://github.com/misty-step/linejam/pull/549)), `/releases` and
`/releases.xml` failed on every request for about 45.6 hours. The release
loader validated release sources with Ajv, which compiles schemas with
`new Function`. Cloudflare Workers forbid code generation from strings, so
every request threw `EvalError` and returned HTTP 500.

Sentry received the errors from the first minute but filed them under
LINEJAM-19, an issue open since 2026-09-10. The privacy transport had removed
everything that told the new errors apart from that issue, so no new-issue
alert fired. An audit found the outage 44.5 hours after it began.

Two classes of error:

- **Runtime:** a route that cannot run on the production runtime can ship.
- **Detection:** redacted failures of different classes look alike to Sentry's
  grouping. A new failure then joins an old issue and raises no new-issue
  alert.

## Impact

- **Observed:** `/releases` and `/releases.xml` returned HTTP 500 for about
  45.6 hours. That runs from the first error at 2026-10-12 23:57:36 UTC until
  the fix deployed at 2026-10-14 21:33 UTC. The errors arrived at 2 to 5 per
  hour.
- **Observed:** gameplay and the home page were unaffected.
- **Observed:** for 44.5 hours no alert presented the failure as new. The only
  alert on it named LINEJAM-19.
- **Inference:** visitors to the release notes, and readers of the RSS feed,
  got errors. Sentry cannot count them, because the transport keeps no user
  data.

## Timeline

| Time (UTC)       | Observation                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-10 10:40 | LINEJAM-19 is first seen: a server `Error` on the Vercel-era Node runtime, cause unknown. It stays unresolved and is marked ongoing on 2026-09-17.                                                                                               |
| 2026-10-12 21:43 | PR #549, the Cloudflare cutover, opens.                                                                                                                                                                                                          |
| 23:40:37         | PR #549 merges as `f17fe8a`.                                                                                                                                                                                                                     |
| 23:50:53         | [Cloudflare Production run 38324259721](https://github.com/misty-step/linejam/actions/runs/38324259721) starts. It succeeds at 23:58:45.                                                                                                         |
| 23:57:36         | The first `EvalError` from the release routes reaches Sentry. Sentry's similarity grouping attaches its new hash to LINEJAM-19, so no issue is created and no new-issue alert can fire.                                                          |
| 2026-10-13 00:00 | A separate browser `EvalError` burst ([LINEJAM-1E](https://misty-step.sentry.io/issues/7788944975/), cause unknown) sends three events in 41 seconds and opens a new issue. Its new-issue alerts fire at 00:01:24. It is not the server failure. |
| 00:00 to 03:00   | The "High frequency error spike" alert (more than 10 events in an hour) fires twice on LINEJAM-19: once before 01:00 and once after 02:00.                                                                                                       |
| 2026-10-14 01:43 | The automated triage intake records its first signal of any kind. Both spike alerts above predate it.                                                                                                                                            |
| 20:27            | An audit finds both routes returning 500.                                                                                                                                                                                                        |
| 20:31:01         | The spike alert fires a third time on LINEJAM-19. Triage receives it 4 seconds later and routes it to the Powder ticket at 20:34.                                                                                                                |
| 21:16:44         | PR #559 merges as `c5802aa`. The routes now read a release catalog that is validated at build time.                                                                                                                                              |
| 21:28:17         | The last `EvalError` arrives, from the release before the fix.                                                                                                                                                                                   |
| 21:30:54         | [Cloudflare Production run 38640849063](https://github.com/misty-step/linejam/actions/runs/38640849063) deploys `c5802aa`. It finishes at 21:33:07.                                                                                              |
| 21:33:31         | Both routes return 200 (`text/html` and `application/xml`). A second check passes at 21:34:43.                                                                                                                                                   |

## Evidence and mechanism

### Runtime

At request time, `lib/releases/loader.ts` validated release sources with Ajv.
Ajv compiles each schema into a function with `new Function`. Node allows
that; workerd, the Cloudflare Workers runtime, throws `EvalError`. So under
Vercel the routes worked, and on the Worker every request failed.

The failure was visible before release. PR #549's description records that
its local Worker served `/releases.xml` with HTTP 500 because the loader
compiles Ajv schemas, and calls this a local limitation. Nothing in the
release path could stop the merge:

- Deploy verification reads only `/api/health`.
- Production Smoke walks only the player path.

### Detection

`lib/sentryPrivacy.ts` sends Sentry only closed-vocabulary data. For these
errors it kept three things:

- the type, `EvalError`
- the fixed label `Error message redacted for privacy (environment: production)`
- stack frames without a filename or function, which Sentry marks as
  contributing nothing to grouping

It dropped the rest:

- **The mechanism.** The allowlist named `auto.http.nextjs.on_request_error`,
  but `@sentry/nextjs` 10.75 sends `auto.function.nextjs.on_request_error`.
  So the transport removed the mechanism, and with it `handled: false`. None of
  the sampled `EvalError` events, on any of the seven Cloudflare releases,
  have a mechanism.
- **The route.** The route allowlist did not include the release routes.

That left Sentry's default grouping only a type and a label. LINEJAM-19 shows
both ways this collapses distinct failures:

- **The same hash.** The Vercel-era server `Error` and a browser unhandled
  rejection on 2026-10-15 share one hash (`b471e97a…`). They have the same
  type, the same label and no contributing frames.
- **A similar hash.** The `EvalError` got its own hash (`5ba73642…`). Sentry's
  similarity grouping then attached it to LINEJAM-19 at distance 0.075
  (`mergedBySeer`).

An event that joins an existing issue is not a first-seen event. So neither the
"New Unhandled Exception" alert nor the new-high-priority alert could fire. A
new issue would still have missed the first one: it requires
`error.unhandled`, and the transport had removed `handled: false`.

That left the frequency alert. At 2 to 5 errors an hour, it crossed its
threshold only in the first hours and once on 2026-10-14. Each time, it named
an issue that had been open for a month.

## Pokayoke

### Detection: closed by PR #567

`beforeSend` in `lib/sentryPrivacy.ts` gives every error event a hybrid
fingerprint. It combines Sentry's default grouping with six closed fields:

- surface (browser or server)
- error class
- mechanism
- operation
- failure code
- route template

Each value comes from a closed allowlist, so the fingerprint carries no message
content or identifiers. Sentry merges events only when their fingerprints are
equal, whether by hash or by similarity, so a new class opens a new issue.

Two supporting changes:

- **Route templates** come from one list, `ROUTE_TEMPLATES`. A test fails
  unless the list equals the routes in `app/`.
- **The mechanism allowlist** now names what the installed SDK sends. Unhandled
  request errors stay unhandled and can reach the unhandled-exception alert.

[`tests/lib/sentryPrivacy.test.ts`](../../tests/lib/sentryPrivacy.test.ts) pins
this behaviour through the real `beforeSend`. These tests fail against the
previous transport. They check that:

- the three LINEJAM-19 classes, in the shapes the SDK sends them, get three
  different fingerprints
- one class keeps one fingerprint across releases, bundle line numbers and the
  `edge` and `node` runtime tags
- each closed field, changed on its own, separates two classes
- the route allowlist equals `app/`, and every route keeps its template but not
  its parameters

**Preview proof, 2026-10-15.** The preview drill
(`/api/internal/sentry-preview-drill`) sent three classes to the Sentry
`preview` environment. They came from a production build of PR #567, first on
Node and then on workerd.

- Two of the classes were identical as far as the previous grouping could see.
  They had the same `Error` type, the same redaction label, the same operation
  and route, and frames without a filename or function. They differed only in
  mechanism.
- Sentry opened a separate issue for each class, and none were merged by
  similarity.
- The stored events contained none of the drill's sentinel text.
- The unhandled class fired "New Unhandled Exception" 19.6 seconds after the
  event. Every new issue fired the new-high-priority alert.
- The unhandled class from Node and from workerd joined one issue,
  [LINEJAM-1G](https://misty-step.sentry.io/issues/7793684836/).
- The handled classes are
  [LINEJAM-1H](https://misty-step.sentry.io/issues/7793684849/) and
  [LINEJAM-1J](https://misty-step.sentry.io/issues/7793684899/) on Node.
  [LINEJAM-1M](https://misty-step.sentry.io/issues/7793692157/) and
  [LINEJAM-1K](https://misty-step.sentry.io/issues/7793692127/) are the same
  classes on workerd. Handled events carry no route there, so they group apart
  from their Node counterparts.

**What can still share an issue:** failures with the same surface, type,
mechanism, operation, failure code, route and label. The transport cannot tell
those apart without keeping content. Handled server captures on the Worker
carry no route, because the SDK sets no transaction there. They are told apart
by the other fields only.

### Runtime: open

PR #559 made the release routes read a catalog that is validated at build time.
[`tests/lib/releases/runtime.test.ts`](../../tests/lib/releases/runtime.test.ts)
renders `/changelog`, `/releases` and `/releases.xml` under
`node --disallow-code-generation-from-strings`, with filesystem imports
blocked. String code generation therefore cannot return to those three routes.

That does not error-proof the class. Any other route, or a dependency, that
breaks on workerd still ships green, because nothing in the release path
renders routes on the Worker. The class stays open until a failing-closed check
does.

## Follow-up

1. **Linejam engineering (Kanban `t_f990ddc4`):** make a route failure on the
   Worker runtime stop the release before production. Prove it by reinstating
   the pre-#559 loader and showing that the check fails. Link that change and
   its check here to close this postmortem.
2. **Powder ticket owner:** after PR #567 is deployed, new events can no longer
   join LINEJAM-19, so the owner may resolve it.
3. **Powder ticket owner:** watch the browser unhandled rejection of
   2026-10-15, whose cause is unknown. With PR #567, a recurrence opens its own
   issue and alerts.
