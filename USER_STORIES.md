# Stories

<!-- Root artifact: what users must be able to do. One file, ids never
reused, criteria a check can fail on. skill://user-stories guides edits. -->

## Capability: Guest party

## US-001 Start and join a room without an account

Statement: When friends are in the same room, I want a code they can open
on their phones without signing up, so we can write together even if
Clerk is down.

Criteria:

1. WHEN a host creates a room, THE SYSTEM SHALL issue a join code and a
   guest session that survives refresh.
2. WHEN a guest presents a valid guest token for an open room, THE SYSTEM
   SHALL join them without an account.
3. IF Clerk is unavailable, THEN THE SYSTEM SHALL still admit guests.

No-gos: no required accounts, ads, or social-network identity.

Evidence: `tests/convex/guestSessions.test.ts`, `tests/convex/guestToken.test.ts`, `tests/app/api/guest-session.test.ts`

## Capability: Poem

## US-002 Write nine lines and reveal the whole poems

Statement: When we play, I want nine rounds of 1-2-3-4-5-4-3-2-1 words
where I only see the line before mine, so the reveal is the first time
anyone hears the whole poem.

Criteria:

1. WHEN a round is assigned, THE SYSTEM SHALL show a writer only the
   preceding line and the word count for that round.
2. WHEN nine rounds complete, THE SYSTEM SHALL reveal each poem's nine
   lines together.
3. IF a player reconnects mid-game, THEN THE SYSTEM SHALL restore their
   seat without duplicating a contribution.

No-gos: no generated player lines, extra modes, or rankings.

Evidence: `tests/convex/game.test.ts`, `tests/assignmentMatrix.test.ts`, `tests/convex/gameRules.test.ts`

## Capability: Keep and share

## US-003 Save privately and publish on purpose

Statement: When a poem is done, I want saving it to stay private until I
explicitly publish a link, so spectators cannot read unpublished text.

Criteria:

1. WHEN a player saves a poem, THE SYSTEM SHALL keep the text private to
   authorized viewers.
2. WHEN a player publishes, THE SYSTEM SHALL issue a reversible public
   link.
3. IF a spectator has no authorization, THEN THE SYSTEM SHALL not leak
   unpublished poem text.

No-gos: no hidden poem text in spectator payloads.

Evidence: `tests/convex/archive.test.ts`, `tests/app/api/poem-card-route.test.ts`
