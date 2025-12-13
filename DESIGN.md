# AI Player Support (Gemini 3)

## Architecture Overview

**Selected Approach**: Convex Action + Scheduler (“AI Turn Engine”)
**Rationale**: AI is backend behavior tied to realtime game state; keep it beside the state (Convex), not in clients or Next routes. Actions own network IO (Gemini); mutations stay deterministic + validate game rules.

**Core Modules**

- `AiPersonaCatalog` – fixed persona set + random pick (no UI selection).
- `AiLobbyService` – host-only add/remove AI player in LOBBY.
- `AiTurnEngine` – schedules AI turns, calls Gemini, commits line, advances round.
- `LineCommit` – shared “insert line + maybe advance game” logic for human+AI.
- `AttributionUI` – bot visuals in lobby/wait/reveal/poem.

**Data Flow**
Host → `ai.addAiPlayer` → (create AI `users` row + `roomPlayers` row) → Lobby shows bot  
Host → `game.startGame` → `AiTurnEngine.schedule(round=0)`  
Round N → humans submit via `game.submitLine` → on round advance → `AiTurnEngine.schedule(round=N+1)`  
Scheduled → `ai.generateLineForRound` (action) → Gemini → `ai.commitAiLine` (mutation) → `LineCommit` → round advance / game complete

**Key Decisions**

1. **AI is a real `users` row** (`kind: 'AI'`) so existing author-name queries keep working.
2. **Persona is immutable per AI add** (stored on that AI user row); removing+re-adding creates a new AI user (history stays correct).
3. **No client dependency**: AI turn generation runs server-side; gameplay never waits on a browser tab.
4. **Internal capability token** gates AI-only mutations (clients can’t forge “bot submits”).

---

## Module: AiPersonaCatalog

Responsibility: define personas + hide selection rules.

Public Interface:

```ts
export type AiPersonaId =
  | 'bashō'
  | 'dickinson'
  | 'cummings'
  | 'chaotic-gremlin'
  | 'overcaffeinated-pal'
  | 'deadpan-oracle';

export type AiPersona = {
  id: AiPersonaId;
  displayName: string; // shown to players
  prompt: string; // style + constraints, no quoted poems
  tags: Array<'real-poet' | 'chaotic'>;
};

export function getPersona(id: AiPersonaId): AiPersona;
export function pickRandomPersona(): AiPersona; // crypto-secure
```

Internal Implementation

- Persona list is static data (no DB).
- `pickRandomPersona()` uses `crypto.getRandomValues` (Convex runtime supports Web Crypto).
- Prompts forbid quoting real poems; “inspired by” only.

---

## Module: AiLobbyService

Responsibility: add/remove exactly one AI player in a room lobby.

Public Interface (Convex):

```ts
export const addAiPlayer: Mutation<
  {
    code: string;
    guestToken?: string;
  },
  {
    aiUserId: Id<'users'>;
    personaId: AiPersonaId;
    displayName: string;
  }
>;

export const removeAiPlayer: Mutation<
  {
    code: string;
    guestToken?: string;
  },
  { removed: boolean }
>;
```

Internal Implementation

- Auth: `requireUser(ctx, guestToken)` then verify `room.hostUserId === user._id`.
- Guardrails:
  - room must be `status: 'LOBBY'`
  - max players still 8
  - if an AI already exists in `roomPlayers`, reject (or return existing)
- On add:
  1. `persona = pickRandomPersona()`
  2. create AI user row:
     - `clerkUserId: "system:ai:" + randomUUID()` (cannot be impersonated via legacy `guestId`)
     - `displayName: persona.displayName`
     - `kind: 'AI'`, `aiPersonaId: persona.id`
  3. insert `roomPlayers` with `userId = aiUserId`, `displayName = persona.displayName`
- On remove:
  - only allowed in `LOBBY`
  - delete that AI’s `roomPlayers` row (keep `users` row for attribution history).

---

## Module: AiTurnEngine

Responsibility: schedule + generate + commit AI lines with a “typing delay”.

Public Interface (Convex):

```ts
// called only by scheduler
export const generateLineForRound: Action<
  {
    roomId: Id<'rooms'>;
    gameId: Id<'games'>;
    round: number; // 0..8
  },
  void
>;
```

Supporting internal mutation (capability-gated):

```ts
export const commitAiLine: Mutation<
  {
    internalToken: string;
    poemId: Id<'poems'>;
    lineIndex: number;
    text: string;
  },
  void
>;
```

Internal Implementation

- Scheduling points:
  - `game.startGame` schedules round 0 if AI present.
  - `LineCommit.advanceIfRoundComplete` schedules next round when round advances.
- Delay:
  - random `delayMs` ∈ [2000, 4000]
  - scheduler: `ctx.scheduler.runAfter(delayMs, api.ai.generateLineForRound, {roomId, gameId, round})`
- Action flow:
  1. load room+game; abort if mismatch (`room.currentGameId !== gameId`, `game.status !== 'IN_PROGRESS'`, `game.currentRound !== round`)
  2. find AI player in room: `roomPlayers` join to `users.kind === 'AI'` (expect ≤1)
  3. compute assigned poem for AI this round:
     - `poemIndex = game.assignmentMatrix[round].findIndex(uid === aiUserId)`
     - `poem = poems.by_game + indexInRoom`
  4. gather context: previous line text (round-1) only (mirrors human constraint)
  5. call `GeminiLineGenerator.generate({ persona, previousLineText, targetWordCount })`
  6. run `ctx.runMutation(api.ai.commitAiLine, { internalToken: env.AI_INTERNAL_TOKEN, poemId, lineIndex: round, text })`

Gemini prompt contract

- Output MUST be a single line of text.
- MUST be exactly N whitespace-separated words.
- No JSON, no quotes, no leading/trailing whitespace.

Word-count enforcement

- Validate `countWords(text) === targetWordCount`.
- Retry up to 2 times with a stricter prompt.
- Final fallback: deterministic word-bank line that always meets N words (never blocks round).

---

## Module: LineCommit

Responsibility: one place to enforce game invariants for “a line got written”.

Public Interface (internal helpers; called by `game.submitLine` and `ai.commitAiLine`)

```ts
type CommitLineArgs = {
  poemId: Id<'poems'>;
  lineIndex: number;
  text: string;
  authorUserId: Id<'users'>;
};

export async function commitLine(
  ctx: MutationCtx,
  args: CommitLineArgs
): Promise<void>;
```

Invariants enforced

- Room has active game; poem belongs to current game.
- `game.currentRound === lineIndex`.
- Assignment matrix matches `authorUserId` for `{lineIndex, poem.indexInRoom}`.
- Word count exact.
- No duplicate line for `{poemId, indexInPoem}`.

Advance rules

- After insert, check if ALL poems have a line for that round.
- If complete and round < 8 → increment round, then `AiTurnEngine.schedule(nextRound)` if AI present.
- If complete and round == 8 → mark game+room+poems completed (existing logic), no AI scheduling.

---

## Module: AttributionUI

Responsibility: make bot presence unmistakable everywhere.

UI rules

- Lobby player row: bot badge + icon (no extra copy).
- Waiting screen: bot avatar badge + tooltip includes “(bot)”.
- Reveal + poem views: each line shows author name; AI lines show bot badge and persona name.

Data shape changes (queries)

- `rooms.getRoomState` adds per-player fields: `{ isBot: boolean; personaId?: AiPersonaId }`
- `game.getRoundProgress` adds `{ isBot: boolean }`
- `game.getRevealPhaseState` returns `myPoem.lines: Array<{ text; authorName; isBot; personaId? }>`
- `poems.getPoemDetail` + `poems.getPublicPoemFull` add `isBot/personaId` per line (reuse `users.kind/aiPersonaId`)

---

## Core Algorithms (Pseudocode)

### addAiPlayer(code, guestToken)

1. user = requireUser(guestToken)
2. room = rooms.by_code(code); assert room.status == LOBBY; assert room.hostUserId == user.\_id
3. assert roomPlayers.count(roomId) < 8
4. if room has AI already → throw or return existing
5. persona = pickRandomPersona()
6. aiUserId = db.insert('users', { clerkUserId: systemId(), displayName: persona.displayName, kind:'AI', aiPersonaId: persona.id, createdAt: now })
7. db.insert('roomPlayers', { roomId, userId: aiUserId, displayName: persona.displayName, joinedAt: now })
8. return { aiUserId, personaId, displayName }

### scheduleAiIfNeeded(roomId, gameId, round)

1. if no AI player in room → return
2. if line already exists for AI-assigned poem at {round} → return
3. delay = random(2000..4000)
4. scheduler.runAfter(delay, ai.generateLineForRound, { roomId, gameId, round })

### generateLineForRound(roomId, gameId, round)

1. load room+game; abort if not current or round changed
2. ai = find AI user in room; persona = AiPersonaCatalog.get(ai.aiPersonaId)
3. poemId = resolve AI’s assigned poem for this round
4. previous = (round>0) ? line(poemId, round-1).text : undefined
5. target = WORD_COUNTS[round]
6. text = GeminiLineGenerator.generate(persona, previous, target)
7. runMutation(ai.commitAiLine, { internalToken, poemId, lineIndex: round, text })

### commitAiLine(internalToken, poemId, lineIndex, text)

1. assert internalToken == env.AI_INTERNAL_TOKEN
2. aiUserId = resolve AI userId for this room (via roomPlayers/users.kind)
3. commitLine({ poemId, lineIndex, text, authorUserId: aiUserId })

---

## File Organization

**New**

- `convex/ai.ts` – `addAiPlayer`, `removeAiPlayer`, `generateLineForRound`, `commitAiLine`
- `convex/lib/ai/personas.ts` – persona catalog + picker
- `convex/lib/ai/gemini.ts` – Google GenAI SDK wrapper (`generateLine(...)`)
- `convex/lib/ai/wordCountGuard.ts` – normalize/validate/retry/fallback
- `components/ui/BotBadge.tsx` – shared bot pill/icon

**Modified**

- `convex/schema.ts` – add `users.kind`, `users.aiPersonaId`
- `convex/game.ts` – call `scheduleAiIfNeeded` on start + round advance; refactor `submitLine` to use `LineCommit`
- `convex/rooms.ts` – extend `getRoomState` to include `isBot/personaId`
- `convex/game.ts` – extend `getRoundProgress` + `getRevealPhaseState` for bot attribution
- `convex/poems.ts` – extend line author payload with `isBot/personaId`
- `components/Lobby.tsx` – Add/Remove AI controls (host-only), bot row styling
- `components/WaitingScreen.tsx` – bot visuals
- `components/PoemDisplay.tsx` (or new `PoemDisplayWithAttribution`) – render author attributions per line

---

## Integration Points

### External Service: Google Gen AI (Gemini 3)

**Env vars (Convex)**

- `GOOGLE_GENAI_API_KEY` (required)
- `AI_MODEL` (default: `gemini-3`, overridable)
- `AI_INTERNAL_TOKEN` (required; random 32+ bytes)

**Dependency**

- Add Google GenAI SDK to `package.json` (exact package per “Google Gen AI SDK” doc chosen during implementation).

### Build/Deploy

- Convex deploy must include new env vars; update `docs/deployment.md` + `.env.example`.
- CI: add presence checks for `GOOGLE_GENAI_API_KEY` only where needed (don’t block unit tests; mock in tests).

### Observability

- Convex action logs:
  - `roomCode/roomId`, `gameId`, `round`, `personaId`, `model`, `latencyMs`, `fallbackUsed`
  - never log raw prompt/poem text (keep content out of logs)
- Next/Sentry:
  - UI failures on add/remove AI captured via existing `captureError`.

---

## State Management

- **Server state**: AI presence (via `roomPlayers` + `users.kind`), persona (`users.aiPersonaId`), lines in `lines`.
- **Client state**: none; clients only render.
- **Cache**: Convex realtime handles fanout; no extra client cache.
- **Concurrency**: scheduler jobs are idempotent via “abort if round changed” + “abort if line exists”.

---

## Error Handling Strategy

Categories

- **Auth**: host-only add/remove → throw user-facing errors (“Only host…”).
- **Validation**: bad word count, wrong round, not assigned → existing errors.
- **External (Gemini)**: retry ≤2; then fallback line (never blocks game).
- **System**: missing env vars → action logs error + uses fallback line.

User-visible behavior

- Add/remove AI failures show alert in Lobby.
- In-game: AI failures are invisible; it still submits a valid fallback line within budget.

---

## Testing Strategy

Unit (Vitest)

- `tests/convex/ai.test.ts`
  - add/remove guardrails (host-only, only in LOBBY, only one AI)
  - AI user creation fields (`kind`, `aiPersonaId`) set correctly
- `tests/convex/game.test.ts`
  - round advance triggers scheduler call when AI present
  - AI commit path uses shared `LineCommit` and advances game
- `tests/lib/ai/*.test.ts`
  - persona picker returns valid persona
  - word-count guard: retries then falls back, always exact N

UI (Testing Library)

- Lobby: shows “Add AI Player” only for host; disables after added; can remove in lobby; bot badge renders.
- Waiting: bot badge renders; progress counts include AI.
- PoemDisplay: author attribution renders; bot lines flagged.

Coverage targets (new code)

- AI core logic (persona/guard/commit): 90%+ branches.
- UI additions: 70%+.

---

## Performance & Security Notes

- **Latency budget**: target “AI line appears” < 5s:
  - 2–4s intentional delay + ≤1s generation average; hard-timeout + fallback if slow.
- **Cost control**: 9 generations per AI per game; log usage; add optional per-room rate limit if abused.
- **Secrets**: API key + internal token only in Convex env; never exposed to client.
- **Prompt safety**: forbid quoting real poems; keep content PG-ish via Gemini safety settings (implementation-time).

---

## Alternative Architectures Considered

| Option                    | Pros                                                         | Cons                                                  | Verdict    |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- | ---------- |
| Convex action + scheduler | single backend boundary; no client dependency; natural delay | introduces actions + secret gating                    | **Chosen** |
| Next.js API route worker  | easy Node SDK; can reuse Next logger/Sentry                  | splits backend; needs Convex auth; scheduling awkward | reject     |
| Client-side Gemini        | simplest code                                                | leaks keys; unreliable; easy abuse                    | reject     |
| External worker/queue     | scalable                                                     | too much infra for MVP                                | reject     |

---

## ADR

Not required (TASK.md doesn’t request). Revisit if we add multi-bot, queueing, or vendor abstraction.

---

## Open Questions / Assumptions

- **Min players**: code currently allows 2; SPEC.md implies “3+”. Keep 2 for now unless product wants to hard-enforce 3.
- **Persona set**: initial list above; confirm which real poets are acceptable.
- **Context window**: AI sees previous line only (mirrors human constraint). Confirm if AI may see more.
- **Post-game removal**: allow remove AI in next-cycle lobby; keep AI `users` row for historic attribution.
