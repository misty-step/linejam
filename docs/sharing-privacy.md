# Sharing Privacy

Linejam share links are opt-in public-by-link.

Participants can replay poems and completed session recaps from inside the room.
Outsiders can read a poem or recap only after a participant explicitly uses the
share or open-shared-link control for that artifact. A room code, poem ID, or
legacy link is not enough by itself to publish content.

## Contract

- Poems remain participant-only until `poems.publicShareEnabled` is `true`.
- Session recaps remain participant-only until `games.publicRecapEnabled` is
  `true`.
- Public page bodies, metadata, and Open Graph images must read through the same
  public queries, so private artifacts render the same not-found fallback across
  HTML and social previews.
- Share controls must tell players that anyone with the link can read the
  shared artifact before copying the URL or opening a native share sheet.
- Copying poem text or saving a poem image is local-only and never publishes.
  Copying the share link is an explicit publication act: it mints a
  non-guessable inert slug, writes that URL, then activates the slug only after
  the clipboard write succeeds. A clipboard failure leaves the slug inactive.
- Native sharing first mints the same kind of inert slug before opening the
  operating-system share sheet. The recipient can receive the real URL while
  it resolves to a bounded pending state, but no poem content is readable until
  the explicit success activation mutation commits. Cancel, failure, or timeout
  leaves the slug inactive and the artifact private.
- Activation and cancellation are generation-guarded, so a stale retry cannot
  revoke a newer successful share. Inactive slugs expire after 30 seconds and
  never return poem text. When a `share` slug is supplied, public queries resolve
  only that slug's own active share row; unknown or inactive slugs never fall
  back to the poem's `publicShareEnabled` state.
- Saving a poem image is participant-only local export. It never enables public
  poem access; the card route authorizes the participant separately.
- Successful-share product analytics flow through the provider-portable client
  analytics surface. Convex exposes no anonymous row-creating share logger.

## Existing Data

Existing poems and completed games may not have the public sharing fields. Treat
missing fields as private. There is no blanket backfill that publishes old poems
or recaps; a participant must share them again to set the explicit opt-in field.

## Indexing And Retention

Public-by-link pages are stable enough to be reshared and indexed by crawlers
that receive the URL. Disabling public sharing clears future public query access;
it does not guarantee removal from third-party caches or already-copied links.

The guest-session throttle accepts only server-signed opaque buckets. Forged
bucket keys are rejected before a rate-limit row is created, repeated requests
reuse one row per bucket, and the scheduled cleanup removes expired rows.
Production resolves the shared signing secret at module load and fails closed
when it is absent. The web tier trusts only App Platform's
`do-connecting-ip` header in production; caller-selected forwarding headers
cannot mint new durable buckets.
