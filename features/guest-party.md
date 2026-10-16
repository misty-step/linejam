# Guest party

Stories: US-001
Source: app/api/guest/**, app/host/**, app/join/**, app/room/[code]/**, app/providers.tsx, convex/rooms.ts, convex/schema.ts, convex/lib/auth.ts, convex/lib/room.ts, convex/lib/parlor.ts, lib/guestSession.ts, lib/auth.ts, middleware.ts, components/Lobby.tsx

Acceptance: [SPEC.md — US-001](../SPEC.md#us-001-live-start-and-join-a-room-without-an-account).

## Driving it

The web guest-session route issues the signed HTTP-only cookie and in-memory bearer; Convex verifies the guest before room creation or admission. `qa/walk --stories "US-001"` exercises a real isolated web/backend guest journey. The existing local QA and browser auth tests provide additional bounded checks, but do not stand in for the story receipt.

Local isolated QA does not certify a hosted Clerk outage or production deployment.
