# Engineering foundation renewal

## Decision and scope

Keep the human party game, Next.js and Convex. Make the meaningful guest game
reproducible before adding infrastructure or replacing the realtime core.
The operator commissioned local engineering/QA implementation and a full
five-direction design exploration. No production deploy, provider mutation,
backlog edit, merge, backup restore or notification drill is commissioned here.

The destination is one guest-first party loop, one authoritative game lifecycle,
one explicit publication boundary, one understandable local acceptance entrypoint,
and separately owned hosted integration and operations. The design destination is
one coherent joyful identity, not five production skins.

## Local system

`compose.yaml` and `scripts/local/` own the disposable environment:

- Real Convex functions, transactions, subscriptions, scheduler and database;
  a real Next application; separate browser and server transport origins.
- Loopback-only published ports, a project-owned database volume and a per-project
  bridge. Runtime egress is not firewall-blocked; hosted integrations are disabled
  and their credentials are absent. Check containers have no network.
- Fresh generated guest credentials shared only by the app and local backend.
  The QA browser gets neither signing nor administrative credentials.
- No host dotenv/config mounts, inherited cloud credentials or registry logins.
  Rootless Docker is supported without changing system groups or socket modes.
- Frozen package installation and a pinned published backend image digest.
  Corepack uses its image-baked cache even when runtime HOME changes; it cannot
  fetch another package manager inside an offline container.
- Startup proves backend connectivity, public-origin alignment and guest-key
  parity, then records actual image IDs and source fingerprints. A watcher does
  not pretend its later edits are covered by an earlier receipt.
- `dev` owns its watchers and shuts down its stack on interruption. `down`
  retains data/evidence. `reset` requires the exact owned project name and rejects
  resources without matching owner, checkout and Compose project labels.

`LINEJAM_LOCAL` and `NEXT_PUBLIC_LINEJAM_LOCAL` must agree, the deployment marker
must be development, and the public Convex URL must be loopback. This is an
explicit guest-only mode, not a fake Clerk issuer or a production bypass.
Accounts truthfully report unavailable; telemetry is disabled. Convex's auth
configuration rejects absent environment reads, so local setup explicitly supplies
empty Clerk inputs to select its existing empty-provider configuration.

Local Next development explicitly admits loopback asset origins. Real browser
acceptance also exposed concurrent cookie-free guest bootstraps returning
different identities; the guest-session module now shares only the in-flight
request. Later reads still consult the cookie, and failed requests remain
retryable. Neither fix relaxes the room membership or production guards.

Local cookie names include the validated public backend origin. Switching
between independent local projects in one browser profile no longer replaces
another project's identity; individual players still need separate profiles.
Ownership checks include the concrete Compose volume/network names, not just
project-label listings. Real disposable sentinels proved that startup and
confirmed reset reject an unlabeled same-name resource without changing it.

Two concurrent projects were exercised through the rendered UI. Frontend and
backend edits reached only the watched project; an excluded non-secret dotenv
canary never entered either watched container. Removing the probes removed the
route and query. Ctrl-C completed teardown with exit 0. Resetting and restarting
that project removed its old room while the other project's room, host identity
and health remained intact.

The exact interface, prerequisites, concurrent-project recipe, failure recovery
and evidence paths live in [local development](local-development.md).

## Acceptance and delivery

The common fast gate remains `pnpm ci:prepush`; the container face calls it
rather than maintaining another copy. `local:check` adds formatting, nonzero
coverage and a non-deploying production build, with networking disabled.
`local:qa` builds/synchronizes a fresh local source snapshot and exercises the
real guest lifecycle using the existing browser specs and evidence producer.
Browser TCP relays preserve the same loopback origins inside the QA container;
they do not mock the app, Convex, HTTP or WebSockets.

Hosted CI adds that secret-free guest lane and requires it to succeed. Existing
hosted account, full E2E, selector and evidence lanes remain separate; the local
lane is not falsely described as their replacement or a complete hosted mirror.

Ordinary Dagger checks no longer sync shared Convex code, create Clerk templates,
seed environment variables or fetch remote guest secrets. Explicit shared-dev
sync remains a separately commissioned, fail-closed operation. Production
rejection cannot be overridden by retired local-check flags.

The OSV audit now consumes the pinned scanner's actual JSON/CVSS contract. Missing
executables, partial network results, scanner errors, malformed output and unknown
severity fail closed. A real scan exposed vulnerable transitive dependencies;
the existing override mechanism was updated to their published patched versions
rather than waiving the findings.

Source-string-only workflow tests were removed; they did not exercise workflow
behavior. Scanner/process and provider-boundary regressions remain. Generated
`.qa` runtime copies/evidence are excluded from source formatting, type analysis,
lint and test discovery; application coverage thresholds and the nonzero-total
guard are unchanged.

Exact checks and the distinction between local, hosted and live acceptance remain
in [testing](testing.md). The runtime receipts and design verification artifacts
are the evidence, not this description of intent.

### Session evidence

Local evidence is retained under `.qa/renewal-evidence/`; it is intentionally
ignored rather than published with room data or credentials. The receipts bind
the real runtime to source fingerprints and actual image IDs. They include the
offline gate, eight-case rendered lifecycle acceptance, ownership sentinels,
shared-profile identity, watch/reset isolation and the dependency audit.

The four-player browser-agent run completed nine human submissions per player,
the reading circle, room closure and fresh rejected re-entry. It exceeded its
15-minute automation bound, so its schema-validated receipt is **failed**, with
`semantic_wait_expired`, not a passed acceptance run. All five sessions were
confirmed closed; retained screenshots were inspected and the room header was
removed from the recap capture. Deterministic container QA is recorded separately.

## Foundation commitments still requiring a separate lane

These remain explicit commitments from the assessment, not silently discarded
work and not claims that this local change has completed production operations.

| Concern                    | Smallest useful next outcome                                                                                                                      | Boundary / owning truth                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Product evidence           | Independent hosted-in-person sessions with consent-safe friction, payoff and voluntary replay evidence                                            | Preserve the existing field-study plan; synthetic games do not establish demand.                             |
| Funnel truth               | A bounded server projection, QA-traffic exclusion and historical membership semantics; started-then-abandoned games must remain visible as starts | Existing calculator/analytics owners; do not build an analytics platform.                                    |
| Room identity              | Finish acceptance of the existing room-auth ownership change instead of starting a competing implementation                                       | Existing overlapping auth PR; one resolved room identity consumed by phases.                                 |
| Mobile trust               | Prove keyboard, text scaling, reconnect and post-reveal actions on real phones                                                                    | Existing mobile PR plus selected design work; desktop emulation is not physical-phone evidence.              |
| Recovery                   | Identify the current backup owner and freshest recoverable copy, then perform an explicitly authorized restore rehearsal                          | `docs/deployment.md`; documented RPO/RTO are not proof of current recoverability.                            |
| Availability and paging    | Reconcile intentionally replaced/disabled workflows, then prove detection reaches an accountable human                                            | Sentry and current operator-owned control plane; do not indiscriminately re-enable old workflows.            |
| Production build authority | Keep compilation distinct from release mutation; reconcile the hosted build contract before changing its public command                           | `pnpm build` remains deployment-oriented for the current App Platform owner. Local commands never invoke it. |
| Privacy outputs            | Reconcile PostHog URLs/identity and JSON logs with the bounded Sentry privacy contract                                                            | Existing privacy work; do not imply one scrubber protects every transport.                                   |
| Legacy data/schema         | Complete the bounded human-only legacy cutover with recovery and cross-environment compatibility evidence before contraction                      | Existing migration sequencing and retention owners; no live cleanup in this lane.                            |
| Publication/release        | Keep one explicit public-sharing authority and one deterministic release-publication path                                                         | Preserve pending-share cancellation/revocation and protected-branch guarantees.                              |
| Operating weight           | Retire superseded incident/release/AI machinery and credentials only with current-owner confirmation                                              | Remove duplicate responsibility, not protection; no new autonomous operating platform.                       |

The next design decision is separate from those live-operation permissions. Its
source inventory, audit, five alternatives and rendered specimens are in
[the design renewal](design/renewal.md) and `explorations/renewal/`.
