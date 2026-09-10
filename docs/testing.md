# Testing and QA

Use the smallest test that can fail for the changed behavior, then prove the
real acceptance surface. Command definitions live in `package.json`; coverage
thresholds live in `vitest.config.ts`.

## Commands

```bash
pnpm vitest run tests/path/to/file.test.ts # focused Vitest
pnpm test                                  # all Vitest tests
pnpm test:ci                               # Vitest coverage + nonzero-total guard
pnpm lint
pnpm typecheck
pnpm ci:prepush                            # fast local pre-push gate

pnpm test:e2e                              # deterministic Playwright suite
pnpm test:e2e:early-smoke                  # host-to-reveal selector contract
pnpm test:e2e:smoke                        # explicit remote target
pnpm test:e2e:evidence                     # tagged evidence spec
pnpm evidence:guest-flow                   # packaged visual/runtime evidence

node scripts/local/cli.mjs check --project dev # secret-free container checks
node scripts/local/cli.mjs qa --project dev    # fresh isolated real guest loop
node scripts/local/cli.mjs down --project dev  # always stop the owned stack

pnpm ci:dagger:all-no-e2e                  # Dagger checks without browser E2E
pnpm ci:dagger:all                         # Dagger checks + full provider-backed E2E
```

`pnpm ci:prepush` remains the common fast check; its composition has one owner,
`package.json`. The local container check consumes that command and adds its
format, coverage, and non-deploying build checks. It does not copy the fast
check's constituent commands.

The hosted `merge-gate` remains authoritative for merge. Acceptance surfaces
are additive, not interchangeable:

| Surface                                         | What it proves                                                                             | What it does not prove                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `pnpm ci:prepush`                               | Fast static/domain/integration checks                                                      | Browser rendering or running backend acceptance                     |
| Local CLI `check`                               | Containerized checks, coverage, and app build                                              | Guest room flow or hosted-provider auth                             |
| Local CLI `qa` / hosted `Isolated Guest QA`     | Fresh local Convex/app guest flow plus runtime evidence, with no provider secrets          | Clerk sign-in, hosted Convex deployment alignment, or Sentry ingest |
| Hosted early smoke, Dagger E2E, and QA Evidence | Existing selector, full auth/browser, and evidence acceptance against configured providers | Secret-free local isolation                                         |

The new guest job must finish with `success`; a skipped/cancelled/failed job
cannot satisfy the merge gate. Existing full E2E/auth and evidence lanes remain.
Neither `ci:dagger:all` nor the local CLI is a complete hosted-pipeline mirror.

`pnpm test:ci` must emit nonzero totals for lines, statements, functions, and
branches before it can pass. Coverage paths are checkout-location independent:
an isolated worktree nested under `.codex`, `.worktrees`, or another harness
directory measures the same repository source surface as a normal checkout.
The machine-readable receipt is `coverage/coverage-summary.json`; the explicit
post-test guard rejects Vitest's otherwise threshold-safe `0/0 Unknown%` state.

## Match evidence to the change

| Change                              | Minimum acceptance                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Documentation or non-runtime config | affected formatting, link/path/command resolution, and relevant schema/importer evidence; no application suite for prose alone |
| Domain utility                      | focused Vitest plus `pnpm ci:prepush`                                                                                          |
| Convex query/mutation/scheduler     | `convex-test` integration on the real scheduler/DB plus fast gate                                                              |
| Component interaction               | Testing Library behavior test plus the relevant browser route                                                                  |
| Game flow/auth/realtime             | Playwright with separate contexts and the targeted Convex deployment                                                           |
| Visual/theme                        | deterministic browser flow and retained screenshots/video/manifest                                                             |
| Deployment/observability            | local gates plus authorized provider, smoke, health, and log postconditions                                                    |

Configuration that changes executable behavior follows the relevant behavior
row, not the documentation row. The pre-push hook policy still applies when
pushing; do not run the same full gate again merely to validate a guide edit.
Hosted CI remains authoritative for merge.

Unit tests are not acceptance for browser rendering, real scheduling,
deployment identity, or production health.

## Test seams

- Replace external network calls, browser APIs, third-party adapters, clocks,
  randomness, and other nondeterminism through an injected owner interface or
  faithful implementation.
- Do not replace modules through Vitest or Jest module mocking. Keep domain
  utilities and component-owned decision logic real, and pass external systems
  through their production boundary.
- Test Convex functions with `setupConvexTest()` from
  `tests/helpers/convexTest.ts`; seed with `tests/helpers/convexSeed.ts` where
  applicable. This exercises indexes, transactions, scheduled functions, and
  generated handlers instead of a hand-built database mock.

## Browser and live-target rules

Playwright uses the checked-in `playwright.config.ts` and
`playwright.smoke.config.ts`. Multi-player scenarios use separate browser
contexts. Never call a remote suite without confirming its base URL and
mutation authority.

The full Dagger E2E lane still needs deployment-aligned Convex, Clerk,
guest-token, and Sentry configuration. Ordinary `all`/`e2e` invocations validate
an existing Clerk Convex JWT template with `--check-only`; they never create
templates, seed Convex environment variables, push code, or fetch remote
`GUEST_TOKEN_SECRET` values. Supply the secret in the invoking environment or a
local dotenv file. These checks may read Clerk configuration and the browser
suite still performs its intended game/auth acceptance actions against its
configured target: check-only preparation does not mean read-only E2E gameplay.

Shared development code sync is a separate, explicitly commissioned operation:

```bash
LINEJAM_ALLOW_SHARED_DEV_CONVEX_SYNC=1 pnpm convex:sync:shared-dev
```

The authority flag must come from this invocation, not a dotenv file. The wrapper
requires an explicit remote URL matching the CLI's active dev deployment,
rejects production unconditionally, and verifies deployment identity after the
one-shot sync. The retired `LINEJAM_SYNC_CONVEX_BEFORE_DAGGER` and
`LINEJAM_ALLOW_PROD_CONVEX_SYNC` flags cannot enable writes in ordinary checks or
bypass this production rejection. Provider setup and production deployment
remain separately authorized operations; possessing credentials is not authority.

Remote smoke requires an explicit `PLAYWRIGHT_BASE_URL`. Production auth smoke
fails closed on test Clerk keys and requires the pre-created smoke account.
Keep `PLAYWRIGHT_REQUIRE_AUTH_E2E` and `PLAYWRIGHT_REQUIRE_AUTH_SMOKE` enabled
unless the lane explicitly requests guest-only evidence and records the gap.

### Cuelume/audio acceptance in a real browser

Use the repository-owned isolated stack, not a synthetic app or shared backend.
Choose an unused project name and ports, record the exact target, and wait for
the CLI's readiness receipt before opening it:

```bash
node scripts/local/cli.mjs up --project audio-qa --app-port 3533 --convex-port 3410 --site-port 3411
# Browser target: http://127.0.0.1:3533
node scripts/local/cli.mjs down --project audio-qa # run after capture, also on failure
```

The caller owns shutdown in this same checkout. `up` leaves services running;
`down` preserves data and artifacts. Use separate browser contexts for the two
guests and an additional same-context, same-origin tab for storage synchronization.
An owned baseline stack needs its own project, ports, and shutdown. Prerequisites
and retained-evidence restrictions are in the isolated guest QA section below.

The focused behavior check is:

```bash
pnpm vitest run tests/hooks/useCeremonyEffects.test.ts
```

That test uses an audio-engine seam; it does not prove rendered sound or trusted
input. Browser behavior is owned by `lib/audio.ts`, `components/SoundControl.tsx`,
and `hooks/useCeremonyEffects.ts`, using the installed `@parlor/web/audio` and
Cuelume recipes. Follow `tests/e2e/support/guestFlow.ts` (`GuestFlowSession`,
`CANONICAL_GUEST_FLOW_LINES`) and `tests/e2e/early-smoke.spec.ts` for the real
host → join → write → reveal procedure; `guest-flow.evidence.spec.ts` owns the
existing evidence flow. Reuse `lib/e2eTestIds.ts` and rendered accessible controls,
not a second game harness. The existing suites do not themselves collect a
destination waveform.

For temporary browser instrumentation:

- Keep normal gesture-required autoplay policy. For Chromium, use
  `--autoplay-policy=user-gesture-required`; do not use an autoplay bypass or
  `--mute-audio`. Record browser/version and relevant launch options. Never make
  evaluator calls count as gestures: use main-world CDP `Runtime.evaluate` with
  `userGesture: false` for inspection, not injected user activation.
- Install the probe before app boot in the **page's main world** (for example,
  CDP `Page.addScriptToEvaluateOnNewDocument` without an isolated `worldName`).
  Observe native context creation and intercept the actual destination connection,
  inserting `upstream → AnalyserNode → original AudioDestinationNode`. Preserve
  native connection behavior and output; do not retain a duplicate direct path,
  create a probe-owned context, resume the context yourself, or replace `play()`.
  An isolated-world patch or a `play()` spy is not audio acceptance.
- Sample `getFloatTimeDomainData` over each labeled action window; `fftSize=2048`
  at roughly 10 ms intervals is a usable starting point. Report the actual window,
  sample count, peak (`max(abs(sample))`), RMS (`sqrt(sum(sample²) / sampleCount)`),
  context count/identity, and context states. Nonzero peak/RMS with a running
  context establishes rendered signal. Record no-context/no-sample windows as
  such, rather than implying they contain measured waveform samples.
- Let scheduled envelopes, shimmer tails, and output settle before opening each
  silence window, then reset accumulators. Derive the wait from the installed
  recipes/engine and record it; a previous cue's tail is not an unsolicited cue.
  With an existing running context, collect actual samples and require zero
  peak/RMS for the silent window. Do not mistake an empty capture for silence.
  Native oscillator/buffer-source starts and scheduled offsets are supplemental
  evidence: a Cuelume recipe can contain multiple layers, so one node is not one
  cue. For example, the installed toggle has two noise layers, not two activations.

Exercise these boundaries through the rendered app:

1. On fresh pages, before any trusted gesture, record
   `navigator.userActivation.hasBeenActive === false`, no audio context/source
   starts, and no output. Page-load/remote cues must not queue up for the first
   gesture. Perform actual pointer activation and native keyboard activation
   (Tab to a control, then Enter and Space), not DOM `.click()` or dispatched
   synthetic events.
2. Create and join with `host-create-room-button` and `join-room-button`.
   Their `loading` activation cue is distinct from the later confirmed `sparkle`
   result; an error is not a success cue. A color-mode control produces one
   `toggle` recipe per activation. Check recipe layers/offsets against the
   installed source to rule out an extra generic `release` recipe, rather than
   requiring one source node or one cue across an entire async operation.
3. After a gesture unlocks audio, observe an async result and a remote cue with
   `hasBeenActive === true` but transient `isActive === false`, reusing the same
   context in that document. For the remote case, reach `session-complete`,
   settle the host's output, and have the other guest favorite a poem so the
   host receives a live `room-favorite-crown` update without another host gesture.
4. Use the real sound controls to mute. All controls must show `Turn sound on`
   with `aria-pressed=false`; after existing tails settle, activation and async
   result windows (such as submit/reveal) stay silent. Reload to check the legacy
   `localStorage` key `linejam:ceremony-muted`: `'1'` preserves explicit mute,
   `'0'` enables sound, and absence is not an opt-out. Change the choice through
   a control in a same-origin tab and observe the other tab's controls/output
   update without remounting. Unmute through `Turn sound on`: one `toggle`
   recipe restores output and all controls show `Mute sound`/`aria-pressed=true`.
5. With `prefers-reduced-motion: reduce`, repeat the remote ceremony: audio still
   produces signal, while ceremony `navigator.vibrate` requests are suppressed.
   Observe haptic calls separately without replacing audio; a desktop browser
   does not prove physical vibration. Mute suppresses both future sound and
   ceremony haptics.
6. With a running, settled context, hover, type in a text input, try a disabled
   control, and hold Enter/Space through repeated key events. The initial legal
   activation may sound; subsequent repeats, hover, typing, and disabled
   activations must remain silent. Keep each window separate from prior tails.

### Guest-session requests and latency evidence

Attach network observation before navigation and count only
`GET /api/guest/session`, per actor/document and at bootstrap, lobby, writing,
waiting, reveal, poem, and recap checkpoints. Do not read or retain request/
response bodies, cookies, authorization headers, guest tokens, or private lines.
Record cumulative counts and phase deltas. Normal settled in-document phase
changes should reuse the acquired guest session; a new tab/full document has
its own bootstrap. Label expiry, refresh, failure, and retry scenarios separately.

Measure user-perceived latency from a trusted activation to a **rendered-ready**
endpoint, not a mutation resolution, network response, or route-shell mount.
Capture `performance.timeOrigin + performance.now()` at trusted `pointerdown`
(or a separately documented native keyboard equivalent), and sample visible
readiness on `requestAnimationFrame` so selector-wait overhead is not the clock.
Use the public selectors and canonical guest-flow procedure above:

- Create → visible `lobby-start-game-button`; join → visible
  `lobby-waiting-for-host-button`.
- Start → visible, usable `writing-line-input`; final-round final submit →
  the assigned visible `reveal-poem-button`.
- Assigned reveal → all expected poem lines rendered, as checked by
  `GuestFlowSession.revealAssignedPoem`, not merely `poem-actions`.
- Existing completed room navigation → rendered `session-complete`; actual
  private archive-card navigation → all expected poem lines rendered.

Record cold versus warm app compilation/cache/bootstrap state and distinguish
full-document navigation from client-side SPA navigation. For full-document
timing, carry only the timestamp/measurement label across navigation in
same-origin `sessionStorage`. If no product link launches an existing-room load,
a temporary measurement-only anchor is acceptable, but label that limitation,
wait for its document's bootstrap to settle before the warm measurement, and
remove it afterward. Do not count that extra tab's bootstrap in the primary
two-guest flow or present its full-document timing as SPA latency.

A performance benchmark requires multiple comparable samples per flow/revision,
consistent browser/host conditions, recorded sample counts and distributions,
and explicit warm-up/discard rules. Prior single local readings are observations,
not a speedup guarantee; fewer session requests do not establish faster room
rendering. Local evidence does not establish hosted Convex latency, Clerk auth,
provider/deployment alignment, physical-speaker audibility, mobile behavior, or
Safari autoplay behavior.

Retain a sanitized measurement receipt with exact commands/target, source revision
and working-tree fingerprint, frontend/backend/lockfile hashes and image identity
from the local readiness receipt, browser/policy, endpoints, sample counts,
audio measurements, request counts, limitations, and cleanup results. Refresh
`up` after source changes; an earlier readiness receipt does not fingerprint
later edits. Never publish raw browser traces or token-bearing data. Keep the
procedure here rather than relying on an ignored run receipt or a removed
one-off script. Finally run `down` for every owned stack, close owned browser
contexts/processes, and remove temporary probes, DOM launchers, measurement
storage, profiles, scripts, and disposable baseline worktrees without deleting
unrelated data or pruning retained local volumes.

## Isolated guest QA and retained evidence

The repository-owned runtime needs Node 22+, a local Linux Docker daemon,
Compose 5.5+, and buildx. Initial image/package/browser installation needs
download access, but the app/backend guest loop runs without shared-provider
credentials. The hosted job runs the same command as local acceptance:

```bash
node scripts/local/cli.mjs qa --project ci
node scripts/local/cli.mjs down --project ci # unconditional cleanup, also on failure
```

The CLI owns fresh-stack preparation, browser execution, and runtime failure
evidence. `qa` leaves the owned stack available for diagnosis; `down` removes
containers/network but retains data and evidence. Hosted evidence is uploaded
before unconditional shutdown and retained for 14 days:

- `.qa/local/linejam-local-ci/receipt.json`
- `.qa/local/linejam-local-ci/artifacts/qa/verdict.json` (allowlisted counts and booleans)
- `.qa/local/linejam-local-ci/artifacts/qa/evidence/*.png`
- `.qa/local/linejam-local-ci/artifacts/qa/evidence/raw-video/*.webm`

Upload those exact paths only. Raw reports, logs, JSON evidence, traces, owner
records, generated credentials, `compose.env`, and private Docker config may
contain credentials and must stay private. Missing evidence fails upload rather
than silently yielding an empty receipt. The verdict rejects recorded flow,
runtime, and artifact errors even when Playwright reports passing tests.

## Dependency audit

`pnpm ci:dagger:audit` uses the pinned OSV-Scanner **v2.0.2** release binary and
`scripts/ci/osv-audit.mjs`, not a regex over advisory text. The gate reads the
scanner's computed `results[].packages[].groups[].max_severity` CVSS string and
preserves the HIGH/CRITICAL threshold (scores **7.0–10.0**). Known scores below
7.0 do not fail the severity gate; unknown/unclassifiable scores do fail closed.

One JSON scan includes all packages and disables call analysis. Only scanner
exit 0/1, empty error-level stderr, valid complete source/package/group data, and
agreement between findings and exit status are accepted. Missing executables,
signals, no packages, network/scanner errors, partial responses, invalid JSON,
and unmatched advisory groups cannot pass. In this pinned release an API paging
timeout can coexist with findings exit 1, so exit status alone is insufficient.

CVSS is owned by FIRST and used by permission. Thresholds follow the
[FIRST qualitative rating scale](https://www.first.org/cvss/v3.1/specification-document#Qualitative-Severity-Rating-Scale);
the pinned scanner, not this wrapper, calculates the scores from OSV vectors.
The wrapper returns 1 for HIGH/CRITICAL findings and 2 for operational/schema
failure; Dagger treats either as a failed audit.

Primary contract references:
[JSON model](https://github.com/google/osv-scanner/blob/v2.0.2/pkg/models/results.go),
[CVSS maximum calculation](https://github.com/google/osv-scanner/blob/v2.0.2/internal/output/table.go),
[CLI output/exit docs](https://github.com/google/osv-scanner/blob/v2.0.2/docs/output.md),
[exit handling](https://github.com/google/osv-scanner/blob/v2.0.2/cmd/osv-scanner/internal/cmd/run.go),
and [partial API handling](https://github.com/google/osv-scanner/blob/v2.0.2/pkg/osvscanner/osvscanner.go).

## Evidence and agentic QA

`pnpm evidence:guest-flow` packages screenshots, video, GIF, server log,
summary, and manifest. Runtime or artifact errors fail unless a typed,
expiring allowlist names the exact known issue and reason. A waiver is visible
evidence of a gap, not proof the behavior passed.

For static rendering that does not need a room flow, use
`pnpm evidence:static-server`; it owns the narrow unsynced-Convex bypass and
disables Sentry ingest for that capture. Do not generalize its escape hatch to
game tests.

Use `.agents/skills/play-linejam/SKILL.md` only for commissioned complete
multiplayer verification. Its concurrent players, nine-round lifecycle, room
closure, fresh-session rejection, and sanitized write-once receipt are not
prerequisites for an isolated rendering or documentation check.

Agentic QA is advisory and never replaces deterministic checks:

```bash
pnpm qa:agentic:local --mission guest-host-signed-in-join
pnpm qa:agentic:preview --mission guest-host-signed-in-join --base-url https://<preview-url>
```

Retain the `.qa/runs/<run-id>/` manifest and critic artifacts when that lane is
part of acceptance.

## Debugging and evidence quality

- Isolate a hanging/failing file first, then narrow to one test. Check leaked
  timers/processes, unresolved mocks, network calls, and unbounded loops.
- Use semantic waits (`waitForURL`, visible/ready state), not sleeps.
- Never silently skip environment-dependent acceptance. Supply the environment
  or name the unverified surface and residual risk.
- Record the exact command, exit result, target surface/deployment, and artifact
  path. Do not infer a pass from an adjacent test or fabricate a receipt.
