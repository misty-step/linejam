---
name: monitor
description: |
  Post-deploy signal watch for linejam. Poll /api/health plus the Canary
  responder readiness surface through a grace window. Emit structured events.
  Escalate to /diagnose on trip, close clean on green. Thin watcher, not
  diagnostician.
  Use when: "monitor signals", "watch the deploy", "is the deploy ok",
  "post-deploy watch", "signal watch", "grace window", "watch production",
  "canary responder alive?".
  Trigger: /monitor.
argument-hint: '[<deploy-receipt-ref>] [--grace <duration>] [--poll <duration>]'
---

# /monitor

Watch linejam's post-deploy signals. Escalate to `/diagnose` on regression.
Close clean when both app health and Canary readiness stay green through the
grace window.

This skill observes and escalates. It does not diagnose root cause
(`/diagnose` does). It does not rollback. It does not page humans. It does
not trigger smoke — `pnpm canary:smoke` is a human / webhook decision.

## Execution Stance

You are a thin watcher.

- Poll `https://www.linejam.app/api/health` and the Fly responder's
  `/healthz` on a fixed cadence.
- Watch the Canary dashboard for new issues + error-burst counts during the
  window.
- On trip: emit one `monitor.alert` with the signal payload, exit, hand off
  to `/diagnose`.
- On clean: emit one `monitor.done`, exit.
- Never analyze why a signal tripped. Never attempt remediation.

## Two Distinct Signals, Not One

**Linejam separates app health from observability readiness.** They share a
grace window but trip independently:

| Signal                                             | Green means                                              | Red means                                     |
| -------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `/api/health` (status 200, body `status: "ok"`)    | Next.js + Convex + `GUEST_TOKEN_SECRET` all live         | App broken — users affected                   |
| `/api/health` body `observability.status: "ready"` | `NEXT_PUBLIC_CANARY_*` keys present                      | Canary ingest degraded — users _not_ affected |
| Fly responder `/healthz` (status 200)              | Responder process alive on Fly                           | Webhook delivery pipeline down                |
| Fly responder `/readyz` (status 200)               | `LINEJAM_CANARY_WEBHOOK_SECRET` + `CANARY_API_KEY` wired | Responder cannot verify signatures            |
| Canary dashboard                                   | No new error groups, burst rate < 10/hr                  | New incident or burst                         |

**Green app-health + red Canary-ingest = degraded observability, NOT an
outage.** Emit `monitor.alert` with `severity: "degraded"` and escalate, but
do not phrase the alert as a gameplay outage. The repo-brief calls out this
conflation as a known debt (`app/api/health/route.ts` still flips 503 on
env-var failures, but the `observability.status` field is now separate).

A canonical `/api/health` response looks like:

```json
{
  "status": "ok",
  "convex": "connected",
  "env": {
    "guestTokenSecret": true,
    "convexUrl": true,
    "clerkPublishableKey": true,
    "canaryIngestKey": true
  },
  "observability": { "status": "ready", "canaryIngestKey": true },
  "timestamp": "2026-04-20T12:00:00Z"
}
```

Parse both `status` and `observability.status`. Do not collapse them into a
single boolean.

## Inputs

| Input                   | Source                           | Default                                                      |
| ----------------------- | -------------------------------- | ------------------------------------------------------------ |
| deploy receipt ref      | positional arg from `/deploy`    | optional; absent → poll defaults                             |
| grace window            | `--grace` flag                   | 5 minutes                                                    |
| poll interval           | `--poll` flag                    | 30 seconds (matches Fly `fly.responder.toml` check interval) |
| app health URL          | `$LINEJAM_HEALTH_URL`            | `https://www.linejam.app/api/health`                         |
| responder health URL    | `$LINEJAM_RESPONDER_HEALTHZ_URL` | `https://linejam-canary-responder.fly.dev/healthz`           |
| responder readiness URL | `$LINEJAM_RESPONDER_READYZ_URL`  | `https://linejam-canary-responder.fly.dev/readyz`            |

Grace period for responder startup: 15s (matches `fly.responder.toml`
`grace_period = "15s"`). Do not count the first `/healthz` miss within 15s
of deploy as a trip.

## Contract

**Emits exactly one terminal event per invocation.** Either `monitor.done`
or `monitor.alert` — never both, never zero.

### Event schema

```json
{
  "schema_version": 1,
  "ts": "2026-04-20T12:00:00Z",
  "kind": "monitor.alert",
  "phase": "monitor",
  "agent": "monitor",
  "refs": ["deploy-receipt:<ref>"],
  "severity": "outage | degraded",
  "findings": [
    {
      "signal": "api-health",
      "url": "https://www.linejam.app/api/health",
      "observed": "503",
      "expected": "200",
      "body": { "status": "unhealthy", "convex": "unreachable" },
      "first_trip_ts": "2026-04-20T12:02:13Z",
      "consecutive_trips": 2,
      "samples": [
        {
          "ts": "2026-04-20T12:01:43Z",
          "status": 503,
          "body": { "status": "unhealthy" }
        },
        {
          "ts": "2026-04-20T12:02:13Z",
          "status": 503,
          "body": { "status": "unhealthy" }
        }
      ]
    }
  ],
  "note": "/api/health returned 503 on two consecutive polls; convex=unreachable; escalating to /diagnose"
}
```

`severity`:

- `outage` — `/api/health` returns non-2xx or body `status != "ok"`, or Fly
  `/healthz` returns non-2xx.
- `degraded` — app health green but `observability.status != "ready"`, OR
  Canary dashboard shows a new issue / burst, OR Fly `/readyz` returns 503.

On `monitor.done` the `findings` array holds the final sample per signal
and `note` summarizes the clean window.

### Exit codes

| Exit | Meaning                                                               |
| ---- | --------------------------------------------------------------------- |
| 0    | `monitor.done` — all signals green through grace window               |
| 2    | `monitor.alert` — signal tripped, escalating (not a tooling failure)  |
| 1    | Tooling failure (config, network unreachable from monitor host, auth) |

## Signals in Detail

### 1. `/api/health` (app liveness) — HARD signal

Polled via `curl -sS -m 10 -w '\n%{http_code}' $LINEJAM_HEALTH_URL`.

- Status != 200 → hard trip (one-shot). No debounce.
- Body `status != "ok"` → hard trip. Convex unreachable, missing
  `GUEST_TOKEN_SECRET`, or missing `NEXT_PUBLIC_CONVEX_URL` all surface here.
- Connection refused, DNS failure, TLS error → hard trip.

Invariant #8 (repo-brief): `GUEST_TOKEN_SECRET` must match across Vercel +
Convex + local. When the app boots without a matching secret, guest joins
silently fail; `/api/health` flips `env.guestTokenSecret: false` and status 503. Treat that as `outage`, not `degraded`.

### 2. `/api/health` `observability.status` — SOFT (degraded) signal

Parsed from the same poll as signal #1. Does NOT re-request.

- `observability.status == "degraded"` (i.e. `NEXT_PUBLIC_CANARY_*` missing
  or placeholder) → soft trip, requires two consecutive polls.
- `severity: "degraded"` in the alert. Gameplay is fine; incident capture
  is not.

Invariant #4 (repo-brief): placeholder Canary keys are not an acceptable
steady state. Build-bearing Dagger lanes fail fast on placeholders; if
production boots with them anyway, the gate has been bypassed. Escalate.

### 3. Fly responder `/healthz` — HARD signal

Polled via `curl -sS -m 5 -w '\n%{http_code}' $LINEJAM_RESPONDER_HEALTHZ_URL`.

- Status != 200 → hard trip.
- Connection refused / timeout → hard trip after one grace poll (Fly's
  `grace_period = "15s"` in `fly.responder.toml`). During the first 15s
  post-deploy, a single miss is expected boot time.

### 4. Fly responder `/readyz` — SOFT (degraded) signal

Polled on the same cadence. Status 503 means
`LINEJAM_CANARY_WEBHOOK_SECRET` or `CANARY_API_KEY` is missing — webhook
delivery will fail signature verification and Canary will see the responder
as dead. Gameplay unaffected; observability pipeline broken.

Two consecutive 503s → `monitor.alert`, `severity: "degraded"`.

### 5. Canary dashboard — SOFT (degraded) signal

Per linejam's alert rules (CLAUDE.md):

- **New issue** — email on first occurrence. Monitor trips on first sighted
  new error group during the grace window.
- **High frequency spike** — burst > 10 events/hr during the window.

Both are `severity: "degraded"` (Canary sees users hitting errors, but the
app still serves). Exit 2, hand to `/diagnose`.

## Escalation Rule

A signal **trips** when:

1. The observed value violates its threshold, AND
2. (for soft signals) the violation is confirmed on the next poll.

**Hard signals trip on one poll:**

- `/api/health` non-2xx or `status != "ok"`
- Fly `/healthz` non-2xx (after the 15s Fly grace)
- DNS / TLS / connection refused

**Soft signals require two consecutive trips:**

- `observability.status == "degraded"`
- Fly `/readyz` 503
- Canary burst rate
- New Canary issue first-seen (but: a confirmed new-issue hit is a trip on
  the second poll; this prevents a single race-against-dashboard-sync from
  paging)

Rationale mirrors spellbook canonical: hard signals mean users are already
affected, no point delaying; soft signals can flap and one confirmation
kills the noise floor.

## Grace Window Judgment

Default 5 minutes, 30s poll. Wall-clock bounded.

- **Do not extend on soft trips.** If `observability.status` flaps back to
  `ready`, keep polling until the deadline but do not reset the window.
- **Do not extend "to wait and see."** If no signal has tripped at the
  deadline, emit `monitor.done`. Continuous production monitoring is not
  this skill's job.
- **Vercel preview vs production:** when the deploy receipt points at a
  preview URL, the `/healthz` check for the Fly responder is irrelevant
  (responder lives outside Vercel, survives preview deploys). Skip it and
  note `"responder-healthz": "skipped (preview deploy)"` in findings.

## Control Flow

```
/monitor [<deploy-receipt-ref>] [--grace 5m] [--poll 30s]
    │
    ▼
  1. Resolve signal URLs (env overrides → production defaults)
  2. deadline = now + grace_window
  3. Poll loop (every poll_interval):
       ├── Parallel fetch: /api/health, /healthz, /readyz
       ├── (Ad-hoc) check Canary dashboard for new issues + burst rate
       ├── HARD trip detected → emit monitor.alert, exit 2
       ├── SOFT trip confirmed (2 consecutive) → emit monitor.alert, exit 2
       └── All green AND now >= deadline → emit monitor.done, exit 0
    │
    ▼
  Emit terminal event. Skill holds no global state between invocations.
```

## Invocation

```bash
# Outer loop: after /deploy reports success on production
/monitor deploy:01HQ...

# Custom grace for a risky deploy (e.g. convex schema change)
/monitor deploy:01HQ... --grace 15m --poll 30s

# Ad-hoc post-incident watch, production URLs from env
/monitor --grace 10m

# Preview deploy (skip Fly responder — it serves prod webhooks only)
LINEJAM_HEALTH_URL=https://linejam-preview-abc.vercel.app/api/health \
LINEJAM_RESPONDER_HEALTHZ_URL= \
  /monitor --grace 5m
```

## Operator Helpers

When confirming signals manually (not part of the skill's automatic poll,
but useful when a human is debugging the monitor output):

```bash
# One-shot app health
curl -sS https://www.linejam.app/api/health | jq

# Responder liveness + config readiness on Fly
curl -sS https://linejam-canary-responder.fly.dev/healthz | jq
curl -sS https://linejam-canary-responder.fly.dev/readyz | jq

# Rerun webhook registration (converges on one subscription by design;
# running twice in a row is explicitly supported by
# docs/ops/canary-responder.md)
pnpm canary:webhook:setup

# Trigger a smoke from the local CLI, bypassing the webhook
pnpm canary:smoke
```

The `canary:webhook:setup` rerunnability contract is load-bearing: if
running it a second time produces a duplicate subscription, that is a bug
in the setup script, not expected behavior. Never edit `/monitor` to
"work around" duplicates by scraping subscription IDs.

## Gotchas

- **`/api/health` 200 + `status: "unhealthy"` is a trip.** HTTP 200 is not
  sufficient — the route returns 503 when Convex is unreachable, but an
  intermediate proxy can rewrite to 200. Parse the body `status` field.
- **`observability.status == "degraded"` is NOT an outage.** Escalate with
  `severity: "degraded"`. Do not write "site is down" in the note — users
  are fine; incident capture isn't.
- **Fly responder has a 15s boot grace.** `fly.responder.toml` sets
  `grace_period = "15s"` on the `/healthz` check. Respect it. One miss
  inside 15s is boot time, not a failure.
- **`LINEJAM_SMOKE_RUNNER=playwright` is the hosted contract.** The Fly
  responder Dockerfile bakes `LINEJAM_SMOKE_RUNNER=playwright`. Local
  operators leave it as `dagger` (authoritative contract). Do not assert
  the runner value here — smoke is out of scope.
- **Never mock Canary state to "speed up" a trip decision.** If the
  dashboard fetch fails, emit `phase.failed` (exit 1), not a fake alert.
- **Do not rollback.** Even on hard outage. The outer loop decides.
- **Do not diagnose in the alert payload.** Include samples, thresholds,
  URLs. Do not speculate ("convex pool probably exhausted"). `/diagnose`
  owns theories.
- **Do not page humans.** Write the alert event and exit 2. Paging belongs
  to whatever wraps `/flywheel`, not here.
- **Do not extend the grace window to avoid escalation.** If it tripped,
  it tripped. Kicking the can teaches callers to distrust the output.
- **Do not conflate `/healthz` and `/readyz`.** `/healthz` is "the process
  is alive"; `/readyz` is "the process can actually verify webhook
  signatures." A live responder with bad secrets will 200 on `/healthz`
  and 503 on `/readyz` — that is `degraded`, not an outage.
- **Preview deploys do not have a dedicated responder.** The Fly
  responder serves production webhooks. Skip `/healthz` + `/readyz`
  checks when the deploy target is a Vercel preview URL.
- **Webhook setup is rerunnable by design.** If a monitor run surfaces a
  missing subscription, just rerun `pnpm canary:webhook:setup`. Per
  `docs/ops/canary-responder.md` it converges on one correct subscription
  for the responder URL and replaces stale duplicates.
