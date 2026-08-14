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
Clerk, Convex, guest-token, and Sentry inputs are available. Dagger may prepare
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

Sentry is Linejam's sole production error, monitor, release, and
incident-evidence platform:

- Browser, Node, Edge, and Convex transports use exact release and environment
  attribution. Browser source maps are uploaded during the production build.
- `linejam-production-health`, `linejam-production-smoke`, and
  `linejam-ai-fallback-rate` are the canonical monitors. The first failed
  production smoke remains non-paging; the second consecutive failure opens the
  monitor issue, and a passing run recovers it.
- Event-driven preview smoke failures are Sentry issues tagged
  `github-actions`, `preview`, and `previewSmoke`; successful preview runs stay
  in GitHub Actions. They are not Cron Monitor check-ins because no schedule
  exists.
- The signed Sentry `event_alert` webhook is accepted in preview and production.
  The listener projects only the closed action, installation, project, issue,
  and event identifiers needed for durable one-to-one GitHub Issue
  synchronization.
- GitHub Issues remains the sole work ledger. Sentry holds incident evidence and
  state, not a backlog; do not create a duplicate task in Powder or Habitat. The
  one claim and `forest:ready` contract is in `CONTRIBUTING.md`.

Critical route logs and Sentry payloads must omit poem or prompt content,
provider bodies, room/game/poem IDs, guest or Clerk identifiers, email, IP
addresses, request/response bodies, cookies, auth headers, query strings,
arbitrary extras or breadcrumbs, frame-local values, and secrets.
`/api/health` reports application health separately from observability ingest,
so degraded ingest is not proof gameplay is down.

## Reusable Misty Step adoption contract

Reuse the boundary and evidence requirements, not Linejam's implementation
details:

1. Give each deployable one Sentry project and stable `development`, `preview`,
   and `production` environments. Every hosted event names a source release;
   minified runtimes upload source maps for that release.
2. Start with the smallest real error paths. Add monitors only for existing
   health, smoke, or bounded-failure decisions; Sentry must not create a second
   scheduler or work ledger.
3. Apply a transport allowlist before enabling ingest. Prove with a forbidden
   sentinel that payloads omit product content, identity, network identifiers,
   request data, secrets, arbitrary context, and frame locals.
4. Route each actionable Sentry issue to exactly one canonical GitHub Issue.
   Deduplicate durably by Sentry installation, project, and issue IDs; retries
   must be leased and bounded. Sentry and GitHub link to each other.
5. Keep diagnosis and fixes human-gated. Required checks, CODEOWNERS approval,
   a separate last-push approval, and the normal deployment workflow retain
   merge and release authority.
6. Before cutover, exercise browser, server, worker, and scheduled paths in
   preview; prove privacy, symbolication, release/runtime attribution, monitor
   transitions, alert delivery, and GitHub deduplication. Compare the old and
   new sinks for a bounded window, then remove the old writers, credentials,
   monitors, and resources in that order.
7. Stop or roll back if prohibited data arrives, an expected failure is missed,
   one Sentry issue creates multiple work items, source attribution is
   ambiguous, or observability changes player-facing availability.

## Serious incidents

Treat an incident as serious when at least one of these observed facts is true:

- private game data, identity data, a credential, or another prohibited value
  crossed its authorized boundary, or a private poem became publicly accessible
  without explicit publication;
- production host, join, write, reconnect, reveal, keep/share, or
  authentication behavior is unavailable, corrupts game state, or violates its
  established product contract;
- a release causes a production regression that requires rollback, disabling a
  component, or an emergency forward fix;
- a security or authorization boundary is bypassed, or durable data is lost,
  irreversibly mutated, or exposed across users;
- a production smoke or monitor reaches its declared incident threshold, or a
  known player-impacting failure was missed by the expected detector.

Open or update one GitHub incident Issue as the work record. Preserve only
privacy-safe facts needed to bound impact, mitigate, recover, and verify the
result. Sentry evidence must not become a second task, and neither an automated
agent nor Sentry/Seer output is an accepted root-cause statement.

## Incident runbook and postmortem record

1. Record the first observed symptom and timestamp in the GitHub incident Issue;
   link the Sentry issue or monitor and the detecting workflow run when present.
2. Bound impact using observed routes, releases, environments, and time ranges.
   Do not copy event payloads, user content, identifiers, or secrets into the
   Issue or postmortem.
3. Mitigate through the normal authorized rollback, disable, or forward-fix
   path. Preserve the product's typed errors and non-blocking reporting
   behavior.
4. Verify recovery against the failed player path or detector, then record the
   exact workflow, deployment, release, and source SHA that supplied the proof.
5. For every serious incident, complete a reviewed postmortem in the GitHub
   incident Issue or an existing repository postmortem record. Use observed
   evidence for every causal statement; label unproved explanations as
   hypotheses. Generated analysis may suggest questions but must never fill in
   a root cause as fact.

The postmortem record must contain:

- status, UTC start/detection/mitigation/recovery times, and factual user impact;
- a UTC timeline whose entries link to durable evidence rather than pasted
  sensitive payloads;
- detection behavior, including whether the expected monitor or smoke caught
  the incident;
- observed contributing conditions and evidence for any reviewed root-cause
  conclusion;
- mitigation, recovery proof, residual risk, and separately owned follow-up
  GitHub Issues.

Four durable evidence links are required for the seeded serious-incident drill
and for every serious incident where those artifacts exist:

1. the Sentry issue or monitor;
2. the canonical GitHub incident Issue;
3. the mitigating or fixing pull request;
4. the affected and recovery release/deployment evidence, including source SHA.

The GitHub incident Issue links all four and the postmortem. Add a backlink to
the incident/postmortem from the Sentry item, PR, and release record so the
chain can be followed from any artifact. If an artifact genuinely does not
exist, record `not applicable` and the observed reason; never invent a link or
a root-cause claim. GitHub Actions and human review remain release authority:
an agent-generated fix is never auto-merged or auto-deployed.

`master` branch protection enforces the `merge-gate` status check, linear
history, resolved review conversations, a current CODEOWNERS approval, and a
separate approval of the last push. Administrators are subject to the same
gate. Sentry Autofix automation remains off; generated diagnosis may draft a
PR only after a human explicitly starts it, and that PR receives no merge or
deployment authority.
