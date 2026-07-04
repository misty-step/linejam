# Canary Responder

Linejam uses Canary as the primary observability sink. The responder is the local-first worker that receives signed Canary webhooks, fetches context from Canary, stores evidence, and triggers the remote Playwright smoke harness.

## Required Environment

- `CANARY_ENDPOINT`
- `CANARY_API_KEY`
- `LINEJAM_CANARY_WEBHOOK_SECRET`
- `PLAYWRIGHT_BASE_URL` for smoke escalation

Optional:

- `LINEJAM_CANARY_WEBHOOK_URL` is only required when running `pnpm canary:webhook:setup`
- `PLAYWRIGHT_CLERK_TEST_EMAIL` overrides the default Clerk smoke user; use an existing account for live Clerk tenants because hosted smoke will not auto-provision against `sk_live_...` keys
- `PLAYWRIGHT_REQUIRE_AUTH_SMOKE=1` makes smoke fail instead of silently skipping the authenticated path
- `LINEJAM_ENFORCE_SMOKE_URL_ALLOWLIST=1` forces hosted smoke to reject untrusted `PLAYWRIGHT_BASE_URL` values
- `LINEJAM_ALLOWED_SMOKE_ORIGINS`, `LINEJAM_ALLOWED_SMOKE_HOSTS`, and `LINEJAM_ALLOWED_SMOKE_HOST_PATTERN` define the smoke allowlist when that guardrail is enabled
- `LINEJAM_CANARY_RESPONDER_PORT` defaults to `8787`; hosted runtimes can also provide `PORT`
- `LINEJAM_CANARY_WEBHOOK_PATH` defaults to `/canary/webhook`
- `LINEJAM_CANARY_STORE_DIR` defaults to `.canary`
- `LINEJAM_CANARY_MAX_BODY_BYTES` defaults to `262144`
- `CANARY_WEBHOOK_SEND_TEST=1` makes `pnpm canary:webhook:setup` send Canary's `canary.ping` delivery after ensuring the subscription
- `CANARY_SMOKE_TRIGGER_ENABLED=0` disables smoke escalation
- `CANARY_SMOKE_MAX_IN_FLIGHT` defaults to `2`
- `CANARY_SMOKE_MAX_PENDING` defaults to `20`
- `CANARY_SMOKE_TIMEOUT_MS` defaults to `600000`
- `LINEJAM_SMOKE_RUNNER=dagger|playwright` defaults to `dagger`; use `playwright` for hosted responders so the worker can execute the smoke suite without embedding Dagger
- `LINEJAM_CANARY_CONTEXT_TIMEOUT_MS` defaults to `5000`
- `LINEJAM_CANARY_RETENTION_DAYS` defaults to `14`
- `LINEJAM_CANARY_PRUNE_INTERVAL_MS` defaults to `3600000`

## Run Locally

```bash
pnpm canary:responder
```

The responder exposes:

- `GET /healthz`
- `GET /readyz`
- `POST /canary/webhook`

`/healthz` is liveness for the process itself. It always returns `200` and reports readiness in the response body. `/readyz` is the strict configuration probe and returns `503` until both `LINEJAM_CANARY_WEBHOOK_SECRET` and `CANARY_API_KEY` are configured.

Linejam's `/api/health` endpoint tracks app availability separately from Canary
readiness. Missing Canary ingest now degrades observability without marking the
entire app unhealthy, so responder alerts should look at both surfaces.

Deliveries are HMAC-SHA256 verified from the raw request body using the `x-signature` header and `LINEJAM_CANARY_WEBHOOK_SECRET`.

## Register the Webhook

```bash
export LINEJAM_CANARY_WEBHOOK_URL="https://your-host.example.com/canary/webhook"
pnpm canary:webhook:setup -- --emit-secret
```

The setup command is idempotent for the configured responder URL. It keeps the exact active subscription when the desired event set already exists and replaces duplicate or stale subscriptions for the same URL when the desired state drifted. Pass `-- --emit-secret` only when you need the newly created signing secret printed; the JSON output redacts it by default. Set `CANARY_WEBHOOK_SEND_TEST=1` to have setup send Canary's built-in `canary.ping` test delivery after ensuring the subscription.

The default subscription set is defined in [`scripts/canary/events.mjs`](../../scripts/canary/events.mjs). Keep that file as the canonical event taxonomy; the responder and webhook setup CLI both consume it directly.

## Evidence Output

Responder artifacts are written under `.canary/`:

- `deliveries/` sanitized delivery metadata plus body hash/size
- `contexts/` Canary report/timeline/incident snapshots
- `smoke/` smoke harness results
- `summaries/` markdown summaries for follow-on agents

The responder prunes stale artifacts from those directories on a rolling basis. Set `LINEJAM_CANARY_RETENTION_DAYS=0` only if you intentionally want to disable pruning.
Pending smoke deliveries are replayed from `.canary/deliveries/` on responder startup so a restart does not silently drop already-accepted follow-up work.

## Smoke Escalation

For the shared automation event set, the responder triggers:

```bash
pnpm ci:dagger:smoke   # local authoritative contract
pnpm test:e2e:smoke    # hosted responders with LINEJAM_SMOKE_RUNNER=playwright
```

This uses `PLAYWRIGHT_BASE_URL` plus the dedicated `playwright.smoke.config.ts` configuration. When `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are set, the smoke suite also exercises a signed-in Clerk join path; `PLAYWRIGHT_CLERK_TEST_EMAIL` only overrides the default smoke user, and live Clerk tenants should point it at a precreated account. Set `PLAYWRIGHT_REQUIRE_AUTH_SMOKE=1` anywhere auth coverage is mandatory, including preview and production smoke jobs.

Local operators should keep the authoritative Dagger contract by leaving `LINEJAM_SMOKE_RUNNER=dagger`. Hosted responders should switch to `LINEJAM_SMOKE_RUNNER=playwright`; the same smoke suite runs directly with Playwright and avoids trying to embed Dagger inside the webhook worker. Hosted smoke still enforces the URL allowlist, rejects `pk_test_...` and `sk_test_...` keys against `https://www.linejam.app`, requires complete Clerk auth env when auth smoke is enabled, and validates the Clerk `convex` JWT template before it launches the browser. The committed Fly deployment files are [`Dockerfile.responder`](../../Dockerfile.responder) and [`fly.responder.toml`](../../fly.responder.toml).

GitHub preview and production smoke workflows also use
`LINEJAM_SMOKE_RUNNER=playwright` so they can upload durable stdout, stderr,
`test-results/`, and `playwright-report/` artifacts on both success and
failure. Protected Vercel previews require `VERCEL_AUTOMATION_BYPASS_SECRET`;
the preview workflow fails in preflight when that repository secret is absent,
and the smoke Playwright config sends it as the `x-vercel-protection-bypass`
header and requests the bypass cookie for in-browser navigation. Agentic QA
after smoke is manual/opt-in for preview and production: set
`LINEJAM_AGENTIC_QA_AFTER_SMOKE=1` and `STAGEHAND_MODEL_API_KEY` only when the
follow-up artifact is intentionally required for an incident or release
decision.

Canary itself treats generic signed webhooks as the stable product contract, so the responder should stay thin: verify, fetch context, store evidence, trigger the smoke harness, then hand off to follow-on agents.

## Production Smoke Failure Wire (linejam-913)

The `Production Smoke` workflow (`.github/workflows/prod-smoke.yml`) runs hourly and, before 2026-07-04, a red run just sat in the Actions tab: it failed hourly for ~15 hours before the operator found the outage by hand. The gate was working; nothing wired the red signal to a human or to BB triage.

Two scripts close that wire, running as the last steps of the job regardless of outcome (`if: always()`):

- `scripts/ops/count-consecutive-prod-smoke-failures.mjs` walks the workflow's recent completed-run history (via the GitHub REST API, `GITHUB_TOKEN`) to compute the consecutive-failure streak ending at the current run. A single blip does not escalate; only a genuine repeat does. On an API error it fails OPEN toward escalation rather than silence.
- `scripts/ops/report-prod-smoke-status.mjs` reports the outcome to the `linejam-production-smoke` Canary TTL monitor (`expected_every_ms=3600000`, `grace_ms=1800000`, created via `POST /api/v1/monitors`) via `POST /api/v1/check-ins`:
  - Success → `status: "ok"` (Canary's Up health state; resolves any open incident).
  - Failure, streak < 2 → `status: "alive"` (still Up; recorded in the monitor's check-in history and the run's step summary, but does not open an incident).
  - Failure, streak >= 2 → `status: "error"` (Canary maps `error` check-ins directly to its Down health state, which opens/holds a `health_transition` incident that BB triage and the bridge feed already consume — no linejam-side webhook or bridge-specific code needed).

  Reuses the existing `NEXT_PUBLIC_CANARY_API_KEY`/`NEXT_PUBLIC_CANARY_ENDPOINT` repository secrets (already ingest-scoped for client-side error reporting); no new secret was provisioned.

Live-verified end to end against the deployed monitor: a first simulated failure stayed `up`/`alive`; a second consecutive simulated failure flipped the monitor to `down` and opened `INC-bhg3g284flhp` (`signal_type: health_transition`); a simulated recovery run immediately resolved it. Query current state any time with:

```bash
curl -fsS "$CANARY_ENDPOINT/api/v1/report?window=24h" -H "Authorization: Bearer $CANARY_API_KEY" | jq '.monitors[] | select(.name=="linejam-production-smoke")'
```
