# QA Personas — Linejam

## Living-Room Host

**Role:** Friend starting a fast in-person game night round.
**Goal:** Create a room, confirm the code is shareable, and get everyone into
the lobby without explaining the UI.
**Common actions:**

- Starts from `/` and taps `Start a Game`
- Reads the 4-letter code aloud and watches the roster update
- Opens help or theme controls before starting

**Edge cases:**

- Starts with only one player and needs the disabled start-state copy
- Switches themes before the second player joins

## Joining Poet

**Role:** Second player entering a spoken room code from another device.
**Goal:** Join quickly, see the host in the lobby, and write lines without
guessing the word-count rules.
**Common actions:**

- Lands on `/join?code=ABCD`
- Enters a display name and confirms the join worked
- Uses the round indicator, WordSlots, and waiting screen to stay in sync

**Edge cases:**

- Mistypes a room code and needs friendly recovery
- Enters too many or too few words and must understand why submit is disabled

## Signed-In Archivist

**Role:** Returning player who wants to browse saved poems and favorites.
**Goal:** Reach `/me/poems`, scan the archive, and open a poem detail page.
**Common actions:**

- Uses header/archive navigation after a session
- Sorts mentally by favorites and recency
- Opens a poem and uses share/favorite controls

**Edge cases:**

- Clerk is not configured and middleware redirects `/me/*` to `/`
- A PR changes shared components used by both archive and reveal views
