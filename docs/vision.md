# Linejam Vision

Status: canonical · Last revised 2026-06-17 (first draft, from /groom mega-sweep)

## Audience and job-to-be-done

**Audience:** small groups of friends, coworkers, or strangers who want a
low-friction creative icebreaker that leaves behind something worth sharing.
Secondary: long-distance friend groups who want a slow, asynchronous creative
ritual.

**JTBD:** "Give us a shared creative moment that produces an artifact we'd
actually re-read and share — without requiring anyone to be good at poetry."

Linejam is a party game, not a poetry tool. The constraint (write the next
line, see only the previous one) is the mechanic; the reveal ceremony and the
shared recap are the product.

## Category

Synchronous-and-asynchronous collaborative party game with an AI co-author
option. Nearest neighbors: Gartic Phone (reveal-driven party game), Jackbox
(audience + party packs), Exquisite Corpse (the format's origin), Codenames
Online (low-friction join).

## Standards

1. **The room never dies.** No group should lose their session because one
   human closed a tab or the host left. (Backed by backlog 016.)
2. **Joining is instant.** A friend with a phone should be in the game in
   under 10 seconds — code, link, or QR.
3. **AI is a collaborator, not filler.** AI lines should read as intentional
   contributions; personas should be verifiably distinct; player text must
   not be able to hijack the AI.
4. **Sharing is the growth loop.** Every completed session produces a
   beautiful, context-rich, shareable recap that makes outsiders want to
   play — and gives the returning group a one-tap "play again."
5. **The artifact persists.** Groups and poems accumulate into a collection
   that rewards return visits.
6. **Operationally boring.** A cold agent or operator can run, debug, and
   recover the deployed surfaces from AGENTS.md + docs alone.

## Non-goals

- Not a creative-writing workshop or critique platform.
- Not a competitive/ranked game. No leaderboards across rooms.
- Not a mobile app — the web surface is the product.
- No user-generated custom game modes in the near term; modes are curated.

## Strategic bets

1. **The reveal is the viral product.** Pass-the-poem is the input; the
   ceremony, recap, and shareable artifact are the content. Invest
   disproportionately in the reveal-and-share loop over the writing UI.
   (ExemplarPremise + RevealVirality lanes.)
2. **Groups are first-class.** Promote rooms into persistent groups with a
   roster, anthology, and comeback cadence. The 4-letter code is a join
   mechanic, not an identity. (ProductValue lane.)
3. **Time-agnostic play.** Ship an async (turn-over-days) mode so the same
   format serves a 10-minute live jam and a multi-day correspondence circle.
   (ExemplarPremise lane; the reveal/recap stack already points here.)
4. **AI as a dial.** Lift the one-AI-seat cap; let any seat count be filled
   with distinct, evaluable personas; support solo/duo practice jams.
   (AIPlayerQuality + ProductValue lanes.)

## What excellent looks like in 6–12 months

- A group plays a live Quick Jam in 10 minutes, shares the recap, and the
  same group returns the next week to a persistent group hub with their
  anthology and a new weekly prompt.
- A long-distance friend group plays asynchronously over a week, gets a
  turn notification, and finishes a poem together without scheduling a call.
- A streamer's audience spectates a jam, hearts poems, and joins the next
  room via QR.
- AI co-authors are verifiably on-persona, can't be prompt-injected via poem
  text, and fill any empty seat — and the team has an eval harness that
  catches persona drift before players do.
- No room has ever stranded in `IN_PROGRESS`; the abandonment cron is so
  reliable that "stuck room" is a phrase no operator has used in months.

## How to use this vision

Every backlog item should name which standard it advances, which bet it
de-risks, or which non-goal it enforces. A ticket that doesn't move any of
these is a candidate for deletion. Revise this doc when live evidence
contradicts it — do not bury direction changes in chat only.
