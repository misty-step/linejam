# components/

React components for game UI and design system primitives.

## Game Screens

| Component           | When Shown                      |
| ------------------- | ------------------------------- |
| `Lobby.tsx`         | Room status = LOBBY             |
| `WritingScreen.tsx` | IN_PROGRESS, player's turn      |
| `WaitingScreen.tsx` | IN_PROGRESS, waiting for others |
| `RevealPhase.tsx`   | COMPLETED, poem reveal          |
| `RevealList.tsx`    | Poem list during reveal         |
| `PoemDisplay.tsx`   | Single poem view                |

## UI Primitives (`ui/`)

Standard component library. Import directly:

```tsx
import { Button, Card, Input, Avatar } from '@/components/ui/Button';
```

Notable:

- `WordSlots.tsx` - Genkoyoushi-style word counter
- `Stamp.tsx` - Vermillion seal animation

## Archive (`archive/`)

Barrel export available:

```tsx
import { PoemCard, ArchiveStats, EmptyArchive } from '@/components/archive';
```

## Layout

- `Header.tsx` - Nav with theme toggle
- `Footer.tsx` - Minimal footer
- `HelpModal.tsx` - Floating help button
