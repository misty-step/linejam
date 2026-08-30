# components/

React components for game UI and design system primitives.

## Game Screens

| Component             | When Shown                      |
| --------------------- | ------------------------------- |
| `Lobby.tsx`           | Room status = LOBBY             |
| `WritingScreen.tsx`   | IN_PROGRESS, player's turn      |
| `WaitingScreen.tsx`   | IN_PROGRESS, waiting for others |
| `RevealPhase.tsx`     | COMPLETED, poem reveal          |
| `SessionRecapHub.tsx` | Completed-session replay hub    |
| `PoemDisplay.tsx`     | Single poem view                |

## UI Primitives (`ui/`)

Standard component library. Import directly:

```tsx
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
```

Notable:

- `WordSlots.tsx` - Genkoyoushi-style word counter

## Archive (`archive/`)

Barrel export available:

```tsx
import { PoemCard, ArchiveStats, EmptyArchive } from '@/components/archive';
```

## Layout

- `Header.tsx` - Navigation with Light/Dark/System appearance access
- `Footer.tsx` - Minimal marketing footer
- `ColorModeControl.tsx` - Native radio control for color mode
- `FocusedEntryAppearance.tsx` - Appearance access without marketing chrome
- `HelpModal.tsx` - In-game instructions
