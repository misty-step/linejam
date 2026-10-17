# Canonical room-cycle analytics

PostHog is the single client analytics seam for the room-cycle funnel. Events are best-effort and counts are deduplicated by the report; the Convex room projection is authoritative for lifecycle stages.

| Stage            | Event             | Properties                                          | Source and notes                                                                                                                                         |
| ---------------- | ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create           | `game_created`    | `roomIdHash`, `cycle`                               | Event-derived; emitted after room creation succeeds.                                                                                                     |
| Join attempt     | `join_attempted`  | none                                                | Emitted when a player submits the join form; no attempted room code or name.                                                                             |
| Join rejection   | `join_failed`     | `failureCode`                                       | Closed vocabulary in `lib/analytics/joinFailure.ts`; expected refusal is not an incident.                                                                |
| Join             | `game_joined`     | `roomIdHash`, `cycle`                               | Event-derived; emitted after join succeeds.                                                                                                              |
| Lobby ready      | `lobby_ready`     | `roomIdHash`, `cycle`                               | Event-derived transition; emitted after start mutation succeeds.                                                                                         |
| Start            | `game_started`    | `roomIdHash`, `cycle`, `playerCount`                | Server-derived report stage; count comes from the start receipt's frozen writers, not lobby presence.                                                    |
| Per-round submit | `line_submitted`  | `roomIdHash`, `cycle`, `round`, `timeToFirstLineMs` | Event-derived; zero-based round. First-line timing is the server's stored line timestamp minus game creation; absent on later rounds or legacy receipts. |
| Reveal           | `game_completed`  | `roomIdHash`, `cycle`, `round`, `playerCount`       | Server-derived report stage; `round` is 8. Count is the completed game's participants.                                                                   |
| Share/save       | `artifact_action` | `roomIdHash`, `cycle`, `round`, `action`            | Event-derived; `action` is `share` or `save`, and only validated actions for known room cycles count.                                                    |

Canonical properties contain no poem text, room code, guest token, guest id, display name, or durable guest identifier. `roomIdHash` is a non-PII internal join key and never appears in report output. Legacy product signals such as `poem_shared`, `poem_image_saved`, `recap_exported`, and `room_invite_shared` remain separate from the canonical funnel and are not consumed by the report.

## Report semantics

`analytics:room-cycle` accepts a bounded server projection plus PostHog events and prints counts only. The cohort is rooms created in the requested half-open window with at least two distinct server-projected human participants. The first cycle is the conversion journey: start, writing completion, and all-revealed require finite in-window server timestamps and a non-abandoned cycle. Later in-window started cycles count as encore. Artifact actions are event-derived and are collapsed by room/cycle/round/action, so retries and share/save repeats do not inflate unique-room conversion. The output labels each metric `server-derived` or `event-derived` and never includes room, participant, poem, or guest fields.
