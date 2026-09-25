# Guest party

Stories: US-001
Source: app/api/guest/**, app/host/**, app/join/**, app/room/[code]/**, app/providers.tsx, convex/rooms.ts, convex/schema.ts, convex/lib/auth.ts, convex/lib/room.ts, convex/lib/parlor.ts, lib/guestSession.ts, lib/auth.ts, middleware.ts, components/Lobby.tsx

## Sub-features

A host creates a four-character invitation code and obtains a signed guest session. Other players join with their own guest identities, without a mandatory account. Room membership and live presence are mediated through the application and Parlor's Convex integration.

## How to get to it (user POV)

On the home page, choose Host a room, supply a pen name, and share the code. On a separate phone or browser session, open Join, enter the code and a different pen name. Refresh either page to check that the guest remains in their seat.

## Driving it

The web guest-session route issues the signed HTTP-only cookie and in-memory bearer; Convex verifies the guest before room creation or admission. `qa/walk --stories "US-001"` exercises a real isolated web/backend guest journey. The existing local QA and browser auth tests provide additional bounded checks, but do not stand in for the story receipt.

## Gotchas

Clerk must remain optional for guest play. A room code alone does not prove identity, and a spectator or a different browser context is not the same returning guest. Local isolated QA does not certify a hosted Clerk outage or a production deployment.
