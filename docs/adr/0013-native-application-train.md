# ADR 0013: Native application train and a secret-free production artifact

Status: candidate implementation; not activated

The native train copies Overmind's maintained `scripts/train.py` and pure
`train_state.py` pattern. It replaces application CI/deployment, not Landmark's
release-note decisions or the accepted Durable Object data cutover. The old
hosted workflow is still active until the native replacement is independently
reviewed and its cutover is exercised. This ADR is not evidence of activation.

`pnpm check` remains the portable fast/full verifier. `pnpm release:check`
composes it with a production build, `release:package`, and `release:verify`.
The only additional build inputs are the three already public browser settings
(Clerk publishable key, PostHog project key, Sentry DSN). The deployment source is
an exact Git revision. Neither guest-signing nor stable Server Action keys enter
builds; Next accepts its stable action key from the runtime environment. There
are currently no application Server Actions with build-time encrypted closures.
The Worker validates required production bindings before forwarding any request.
The local-development opt-in and its guards are unchanged.

The deploy input is `.release/wrangler.json`, its prebundled modules and assets.
Both isolated workerd verification and native Wrangler consume that input, with
no rebundling. Existing Worker secrets remain bound; this release neither reads
nor rewrites guest, Clerk, action, backend-admin or provenance secrets. The public
Clerk/DSN settings also keep their existing secret binding types. Tests inject
only disposable identities and the existing public settings, block all external
Worker/browser requests, and exercise the real DO, not an invented backend.

The native executor clones each candidate into a disposable checkout. Its
nonroot, read-only-root Docker build has bounded resources in
`gha-runners.slice`; no credential, password-store, SSH-agent or Docker-socket
mounts. Trusted source, public settings, toolchains and the lockfile-matched
Wrangler are outside writable build state. Before reading the shared narrow CD
credential, the controller removes the build process and checkout, validates
the complete packaged config against trusted Git, rejects links/special files
and executable configuration discovery, and stages ordinary files. Artifact
hashes here protect the same-tested-input promotion boundary, not a second
project evidence archive.

A pure reducer owns selection, build, forward-only promotion, smoke, rollback
and recovery. The append-only fsynced journal projects current state and records
the exact prior Worker version and source before the first provider mutation.
Interrupted promotions recover first. Failed rollback/recovery requires an
operator decision. Automatic recovery changes only the Worker pointer, never
player data. A changed DO migration contract requires an explicit compatible
recovery decision. Existing SQLite classes, migration tag and data are retained.

Fast ticks coalesce unchanged attempted trunk. Twice-daily full invocations run
unchanged trunk as diagnostics and cannot promote. The existing native lock
serializes promotion; full invocations wait rather than disappear on collision.
The no-agent engineer-profile adapters run over SSH and use the native Sentry
CLI for source-independent failed/missed/timeout/recovery monitoring in the
existing Linejam project. No model, provider or new credential is introduced.
`native-run.sh` owns its installed machine settings and schedule contract.

Promotion checks that serving source is an ancestor, then reads back provider
version/annotation, source-bound backend health/parity, the player entry shell
and the exact tested WASM module. A first rollback can recover the pre-Rust
shell; it does not require the old version to contain the new Rust element.
Live browser story proof and before/after human analytics remain release
acceptance, not something an isolated pass can claim.

Activation work remains explicit: independently review new code, provision the
trusted deploy tool at the lockfile version, retire the replaced hosted workflow
in the activating revision, install the native adapters, exercise real provider
promotion/compatible recovery and Sentry intake, and inspect the live Rust story.
Do not promote the earlier local-mode Worker or repeat the data migration.
