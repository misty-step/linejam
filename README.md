# Linejam

Pass-the-poem party game for friends in the same room.

## What It Is

Players take turns adding lines to poems they can't fully see. Each round, you see only the previous line—then write the next one with a specific word count. At the end, everyone reads the complete poems aloud. Chaos, beauty, and laughter ensue.

## How It Works

1. **Host creates a room** → Gets a 4-letter code
2. **Friends join** → Enter the code and their name
3. **Write in rounds** → 9 rounds with word counts: 1, 2, 3, 4, 5, 4, 3, 2, 1
4. **Reveal ceremony** → Each player reads one complete poem aloud

The constraint is the game. You see only the line before yours. The result is collaborative absurdity—poems that no single person could have written.

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript
- **Backend**: Convex (real-time sync)
- **Styling**: Tailwind CSS 4, custom design system
- **Auth**: Clerk (optional) + anonymous guests

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Add your Convex and Clerk keys

# Run development servers
pnpm dev          # Next.js on :3000
npx convex dev    # Convex backend
```

## Secret Scanning

Pre-commit hooks automatically scan for leaked credentials (Clerk, Convex, Sentry keys).

```bash
# Install gitleaks (required for local development)
brew install gitleaks
```

**False positives?** Add patterns to `.gitleaks.toml` allowlist section.
**Hook failing?** Ensure gitleaks is installed: `brew install gitleaks`

## Design

Zen Garden aesthetic—Kenya Hara minimalism with warm white, near-black text, and vermillion accent. Typography: Cormorant Garamond for display, Inter for body.

## License

Private. All rights reserved.
