# Canary Responder

Linejam uses Canary as the primary observability sink. The responder is the local-first worker that receives signed Canary webhooks, fetches context from Canary, stores evidence, and triggers the remote Playwright smoke harness.

## Required Environment

- `CANARY_ENDPOINT`
- `CANARY_API_KEY`
- `LINEJAM_CANARY_WEBHOOK_SECRET`
- `PLAYWRIGHT_BASE_URL` for smoke escalation

Optional:

- `LINEJAM_CANARY_WEBHOOK_URL` is only required when running `pnpm canary:webhook:setup`
- `PLAYWRIGHT_CLERK_TEST_EMAIL` overrides the default provisioned Clerk smoke user
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
pnpm canary:webhook:setup
```

The setup command is idempotent for the configured responder URL. It keeps the exact active subscription when the desired event set already exists and replaces duplicate or stale subscriptions for the same URL when the desired state drifted. Set `CANARY_WEBHOOK_SEND_TEST=1` to have setup send Canary's built-in `canary.ping` test delivery after ensuring the subscription.

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

This uses `PLAYWRIGHT_BASE_URL` plus the dedicated `playwright.smoke.config.ts` configuration. When `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are set, the smoke suite also exercises a signed-in Clerk join path; `PLAYWRIGHT_CLERK_TEST_EMAIL` only overrides the default provisioned user. Set `PLAYWRIGHT_REQUIRE_AUTH_SMOKE=1` anywhere auth coverage is mandatory, including preview and production smoke jobs.

Local operators should keep the authoritative Dagger contract by leaving `LINEJAM_SMOKE_RUNNER=dagger`. Hosted responders should switch to `LINEJAM_SMOKE_RUNNER=playwright`; the same smoke suite runs directly with Playwright and avoids trying to embed Dagger inside the webhook worker. Hosted smoke still enforces the URL allowlist, rejects `pk_test_...` keys against `https://www.linejam.app`, and validates the Clerk `convex` JWT template before it launches the browser. The committed Fly deployment files are [`Dockerfile.responder`](../../Dockerfile.responder) and [`fly.responder.toml`](../../fly.responder.toml).

Canary itself treats generic signed webhooks as the stable product contract, so the responder should stay thin: verify, fetch context, store evidence, trigger the smoke harness, then hand off to follow-on agents.
