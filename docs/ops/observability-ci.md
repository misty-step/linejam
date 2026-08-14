# Operations, authority, and CI

Canonical operating contract for agent and human delivery lanes. Provider
commands and production recovery live in `docs/deployment.md`.

## Three execution classes

| Class                           | Examples                                                              | Rule                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Long-running local process      | `pnpm dev`, `pnpm dev:convex`, watch modes, app/responder/MCP servers | Do not start unless explicitly commissioned with target, lifetime, and shutdown owner.                                  |
| Bounded shared development      | metadata probes, `convex dev --once`, scoped dev migration            | Allowed with explicit operation authority, confirmed non-production target, redacted output, and a named postcondition. |
| Production or external mutation | deploy, env/data write, smoke trigger, provider change, merge         | Requires explicit live authority for that operation and every repository/provider fail-closed guard.                    |

An environment flag never grants authority; it only proves the caller crossed a
named safety interlock after authority was granted.

## Safe shared-development Convex sync

Use the repository face, not bare `convex dev`:

```bash
LINEJAM_ALLOW_SHARED_DEV_CONVEX_SYNC=1 pnpm convex:sync:shared-dev
```

The flag must be present in the invoking process; putting it in a dotenv file
does not authorize the operation. `scripts/ci/dagger-call.sh` loads the normal
env files, requires an explicit remote `NEXT_PUBLIC_CONVEX_URL`, resolves both
the active dev and production URLs with `convex function-spec`, rejects local,
production, and mismatched targets, runs exactly:

```bash
pnpm exec convex dev --once --typecheck disable --codegen disable
```

It suppresses routine sync output, then performs a fresh `function-spec` read
and fails if the deployment identity changed. The command is bounded and does
not start the Convex watcher.

Convex CLI authentication normally comes from `~/.convex/config.json`. In an
isolated environment, an operator may inject `CONVEX_OVERRIDE_ACCESS_TOKEN`
through the approved credential plane. Never print, copy into chat, or commit
that token.

## Probes and dev migrations

- Prefer `pnpm exec convex function-spec`; it returns function metadata without
  data or environment values.
- To assert one function landed, run
  `node scripts/convex/probe-function-exists.mjs <module.js:functionName>`.
- Avoid `convex env list`: it can reveal values. If names are essential, use
  the repo-owned
  `node scripts/ci/reconcile-convex-env.mjs --target <environment>` command. It
  pins `--names-only`, validates the output shape, and emits names only.
- A dev migration requires explicit authority naming the function, arguments,
  target deployment, expected affected rows/state, and rollback or recovery.
  Confirm the target as above, run the bounded `pnpm exec convex run ...`
  command without `--prod`, then execute the named query/probe postcondition.
- Prove migration logic with `convex-test` before touching a shared deployment.

Production Convex deploys remain fail-closed. Local Dagger rejects them unless
`LINEJAM_ALLOW_PROD_CONVEX_SYNC=1`; hosted builds additionally enforce the
`LINEJAM_DEPLOY_ENVIRONMENT`/`CONVEX_DEPLOY_KEY` contract. These guards do not
replace operator authority. See `docs/deployment.md`.

## Verification ladder

1. Focused test/lint/typecheck for the changed surface.
2. `pnpm ci:prepush`: provider-retirement check, typecheck, lint, and Vitest.
3. Proportionate browser, evidence, or live-dev proof from `docs/testing.md`.
4. Hosted `.github/workflows/ci.yml` merge gate: quality, test/build, early
   selector smoke, E2E, and QA evidence jobs as configured there.
5. After an authorized merge/deploy, confirm source SHA, provider deployment
   health, production smoke, public route postconditions, and relevant logs.

The production hosted build adds two postconditions before activation:

1. `config/convex-env-manifest.json` must match the exact target deployment's
   names-only inventory.
2. The web `GUEST_TOKEN_SECRET` must sign a zero-write proof accepted by that
   deployment's guest-session throttle.

`/api/health` repeats the second postcondition and uses the same manifest for
runtime required-name health, so the scheduled monitor catches later drift.

`pnpm ci:dagger:all` is the local full-contract mirror when Docker and required
Clerk, Convex, guest-token, and Canary inputs are available. Dagger may prepare
the active dev backend for `all`/`e2e`; production sync still needs its explicit
guard. Do not label `ci:prepush` or unit tests as deployment proof.

## Review through production

- Review the artifact and oracle, not the author's intent. Resolve actionable
  findings and rerun affected checks.
- A PR targets `master`, carries exact evidence and residual risk, and waits for
  the hosted merge gate. Do not merge a red or stale head.
- Merge, deployment, smoke, monitoring, and production verification are
  separate authorized operations. A green PR does not prove production.
- After deployment, match the live source SHA, verify App Platform phases and
  health routes, run the relevant deterministic smoke, and inspect value-free
  logs. Keep monitoring through the defined observation window; use a normal
  revert/forward fix, never destructive history.

## Observability facts

Canary is the incident sink. Critical route logs are structured and must omit
guest tokens, display names, request bodies, and secrets. `/api/health` reports
application health separately from Canary readiness, so degraded ingest is not
proof gameplay is down. Responder operation is documented in
`docs/ops/canary-responder.md`.
