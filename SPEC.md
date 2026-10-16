# Linejam

The existing guest-party, poem, keep-and-share and release stories are in
[USER_STORIES.md](USER_STORIES.md). Their canonical-spec consolidation is a
separate in-flight change; this slice does not redefine those behaviors.

## Capability: Measured usage

## US-005 Understand which player stories are used without collecting content

As the product owner, I want anonymous pageviews, sessions and story outcomes
so I can steer the product without reading players' private work.

Criteria:

1. A configured production browser records pageviews and sessions, including
   guest play without a signed-in account. Events carry `app=linejam`, the
   environment and source release. Unconfigured browsers send nothing.
2. The existing `game_created` and `game_joined` outcomes measure US-001;
   `line_submitted` and `game_completed` measure US-002; `artifact_action`
   measures US-003. Existing supporting funnel/share signals remain available.
   A retried room/cycle/round/action is counted once per browser runtime.
3. Analytics contains no names, emails, account IDs, guest tokens, room codes,
   poem text, query strings, fragments, raw private paths or IP/geolocation
   enrichment. Routes are templates. Browser identifiers are random,
   host-scoped pseudonyms, not signed-in identities. Autocapture, replay,
   surveys and automatic exception/performance capture are disabled.
4. SDK exceptions and an unavailable analytics sink never prevent admission,
   writing, reveal, saving or sharing. A later user action can be captured
   after the sink recovers; failed actions are not invented or backfilled.
5. Browser automation and nonproduction events are marked synthetic, so they
   can be excluded from human-usage aggregates. Anonymous browsers are not
   guaranteed to represent unique people across devices or cleared storage.
