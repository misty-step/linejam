# AI Player Support

## Problem Statement

Linejam requires 3+ players for a satisfying game, but users often can't find enough friends online simultaneously. Solo players or pairs have no way to experience the game, limiting adoption and session frequency.

## User Personas

### Primary: The Eager Pair

- **Context**: Two friends want to play together but have no third player
- **Pain Point**: Game requires 3 players; they're stuck in lobby waiting for someone who may never come
- **Goal**: Start playing immediately with whoever is available
- **Success**: Complete a full 9-round game and create poems they enjoy

### Secondary: The Curious Solo

- **Context**: Discovered Linejam, wants to try it out alone
- **Pain Point**: Can't experience the collaborative poetry mechanic without recruiting friends first
- **Goal**: Understand the game flow and see if it's worth sharing with friends
- **Success**: Plays a satisfying game that demonstrates the collaborative magic

## User Stories & Acceptance Criteria

### Story 1: Add AI Player to Lobby

As a **host**, I want to **add an AI player to my lobby** so that **we can reach the 3-player minimum and start playing**.

**Acceptance Criteria**:

- [ ] Host sees an "Add AI Player" option in the lobby when fewer than max players
- [ ] Clicking adds the AI player to the player list immediately
- [ ] AI player is visually distinct (bot icon, clear AI name/persona)
- [ ] Only one AI player can be added per game
- [ ] Option disappears or disables after AI is added

### Story 2: AI Player Participates in Game

As a **player**, I want the **AI player to write lines when assigned** so that **the game flows smoothly without waiting**.

**Acceptance Criteria**:

- [ ] AI player receives assignments like any other player
- [ ] AI submits lines that respect word count constraints (1-5 words per round rules)
- [ ] AI lines are coherent poetry in the chosen persona's style
- [ ] AI submissions happen with slight delay (feels natural, not instant)

### Story 3: Recognize AI Contributions

As a **player**, I want to **clearly see which lines came from the AI** so that **I understand the collaborative mix**.

**Acceptance Criteria**:

- [ ] AI player shows distinct avatar/icon in player list
- [ ] Line attributions show AI's persona name with bot indicator
- [ ] No ambiguity—users never wonder "was that a human?"

### Story 4: Remove AI Player

As a **host**, I want to **remove the AI player if a human joins** so that **I can prefer human collaborators**.

**Acceptance Criteria**:

- [ ] Host can remove AI player from lobby before game starts
- [ ] Removal is instant; seat opens for human player
- [ ] Cannot remove AI once game is IN_PROGRESS

## UX Flow

```
[Lobby: 2 players] → [Host clicks "Add AI"] → [AI joins as 3rd player]
                                                      ↓
[Lobby: 3 players] → [Host starts game] → [Game runs normally]
                                                      ↓
[Round N] → [AI's turn] → [AI generates line ~2-4s] → [Line appears]
                                                      ↓
[Reveal phase] → [Poems shown with author attributions] → [AI lines marked]
```

**Lobby State**:

- Player list shows: Human avatars + AI player with bot icon
- AI player row: Distinct styling (subtle background, bot badge)
- "Add AI" button: Appears when < max players AND no AI present

**In-Game**:

- AI submits during its assigned rounds (no player action needed)
- Brief "typing" indicator or delay before AI line appears
- Line appears in poem like any other contribution

**Reveal**:

- AI author name shown with consistent bot indicator
- No special callout—just clearly labeled like any player

## Success Metrics

| Metric                        | Current        | Target                            | How Measured                  |
| ----------------------------- | -------------- | --------------------------------- | ----------------------------- |
| Games with <3 humans started  | 0%             | 30%+ of games include AI          | Query games with AI player    |
| Solo/pair session abandonment | High (assumed) | -50%                              | Lobby → game start conversion |
| AI line quality (subjective)  | N/A            | "fits the poem" per user feedback | Optional post-game survey     |

## Business Constraints

- **API Costs**: Gemini API calls have cost; monitor per-game spend
- **Rate Limits**: Google GenAI SDK has rate limits; handle gracefully
- **Latency**: AI response time affects game feel; target <5s per line

## Non-Goals (Explicit Scope Boundaries)

- **Multiple AI players** — one per game maximum; keeps human element central
- **AI persona selection** — single persona for MVP; expand later
- **AI difficulty levels** — one behavior; not adjusting "skill"
- **AI in reveal/reading phase** — AI doesn't read poems aloud or react
- **AI chat/banter** — AI only writes poem lines, no lobby chat
- **Offline/cached AI** — requires live API; no fallback poet

## Open Questions for Architect

1. **Poet Persona**: Which real poet should the AI embody? Candidates:
   - **Emily Dickinson** — terse, dashes, fits word constraints naturally
   - **Matsuo Bashō** — haiku master, aligns with Kenya Hara aesthetic
   - **E.E. Cummings** — playful, unconventional, memorable

2. **AI User Record**: Singleton in `users` table with special flag, or separate mechanism?

3. **Generation Trigger**: Convex scheduled function polling for AI turns, or webhook/action triggered on round advance?

4. **Context Window**: How much poem context does AI see when writing its line? Previous line only? All visible lines?

5. **Failure Handling**: If Gemini API fails, what happens? Skip AI turn? Retry? Fallback text?
